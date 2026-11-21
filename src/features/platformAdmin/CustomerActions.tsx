import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IdempotentAction } from "../../shared/api/idempotency";
import { addCredits, changePlan, changeStatus, endSessions, fetchPlans, recordPayment, type CustomerRow, type RecordPaymentBody } from "./adminApi";
import { ReasonDialog } from "./ReasonDialog";
import { tzs } from "./format";

type Action = "payment" | "credits" | "plan" | "sessions" | "suspend" | "reactivate";
const today = () => new Date().toISOString().slice(0, 10);

export function CustomerActions({ row }: { row: CustomerRow }) {
  const [open, setOpen] = useState<Action | null>(null);
  const subscribed = row.subscription_id != null;
  const suspended = row.status === "suspended";
  return (
    <div className="ari-actions">
      <h3>Actions</h3>
      <div className="ari-actions__buttons">
        <button type="button" className="button button--primary" disabled={!subscribed} onClick={() => setOpen("payment")}>Record payment</button>
        <button type="button" className="button button--quiet" disabled={!subscribed || row.credits_unlimited} onClick={() => setOpen("credits")}>Add credits</button>
        <button type="button" className="button button--quiet" disabled={!subscribed} onClick={() => setOpen("plan")}>Change plan</button>
        <button type="button" className="button button--quiet" onClick={() => setOpen("sessions")}>End all sessions</button>
        {suspended
          ? <button type="button" className="button button--quiet" onClick={() => setOpen("reactivate")}>Reactivate account</button>
          : <button type="button" className="button button--danger-quiet" disabled={!subscribed} onClick={() => setOpen("suspend")}>Suspend account</button>}
      </div>
      {open === "payment" ? <PaymentDialog row={row} onClose={() => setOpen(null)} /> : null}
      {open === "credits" ? <CreditsDialog row={row} onClose={() => setOpen(null)} /> : null}
      {open === "plan" ? <PlanDialog row={row} onClose={() => setOpen(null)} /> : null}
      {open === "sessions" ? <SessionsDialog row={row} onClose={() => setOpen(null)} /> : null}
      {open === "suspend" || open === "reactivate" ? <StatusDialog row={row} target={open === "suspend" ? "suspended" : "active"} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function useConsoleMutation<T>(fn: (reason: string) => Promise<T>, onDone: () => void) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["platform-admin"] }); onDone(); },
  });
}

function PaymentDialog({ row, onClose }: { row: CustomerRow; onClose: () => void }) {
  const action = useRef(new IdempotentAction());
  const [purpose, setPurpose] = useState<"plan_period" | "top_up">("plan_period");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<RecordPaymentBody["method"]>("bank_transfer");
  const [paidOn, setPaidOn] = useState(today());
  const [reference, setReference] = useState("");
  const [coversFrom, setCoversFrom] = useState(today());
  const [coversUntil, setCoversUntil] = useState("");
  const [credits, setCredits] = useState("10");
  const body = (reason: string): RecordPaymentBody => ({
    purpose, amount: Number(amount), method, paid_on: paidOn, reference: reference || null, note: reason,
    ...(purpose === "plan_period" ? { covers_from: coversFrom, covers_until: coversUntil } : { credits: Number(credits) }),
  });
  const mutation = useConsoleMutation(async (reason: string) => {
    const request = body(reason);
    try {
      const result = await recordPayment(row.subscription_id!, request, action.current.keyFor(request));
      action.current.settle();
      return result;
    } catch (error) { action.current.settle(error); throw error; }
  }, onClose);
  const valid = Number(amount) > 0 && (purpose === "top_up" ? Number(credits) > 0 : coversUntil >= coversFrom && !!coversUntil);
  return (
    <ReasonDialog title={`Record payment · ${row.organization_name}`} confirmLabel="Record payment" busy={mutation.isPending}
      error={mutation.error} canConfirm={valid} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Record a payment received outside the app (no card payments in v1). A payment is never edited; a mistake is reversed from the Payments page.</p>}>
      <fieldset className="ari-fieldset"><legend>Pays for</legend>
        <label><input type="radio" name="purpose" checked={purpose === "plan_period"} onChange={() => setPurpose("plan_period")} /> Plan period</label>
        <label><input type="radio" name="purpose" checked={purpose === "top_up"} onChange={() => setPurpose("top_up")} /> Top-up credits</label>
      </fieldset>
      <div className="ari-grid">
        <label className="field">Amount (TZS)<input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} required /></label>
        <label className="field">Method
          <select value={method} onChange={(e) => setMethod(e.target.value as RecordPaymentBody["method"])}>
            <option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="cash">Cash</option><option value="other">Other</option>
          </select>
        </label>
        <label className="field">Paid on<input type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} /></label>
        <label className="field">Reference (optional)<input value={reference} maxLength={255} onChange={(e) => setReference(e.target.value)} /></label>
        {purpose === "plan_period" ? <>
          <label className="field">Covers from<input type="date" value={coversFrom} onChange={(e) => setCoversFrom(e.target.value)} /></label>
          <label className="field">Covers until<input type="date" value={coversUntil} min={coversFrom} onChange={(e) => setCoversUntil(e.target.value)} /></label>
        </> : <label className="field">Credits<input inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} /></label>}
      </div>
    </ReasonDialog>
  );
}

function CreditsDialog({ row, onClose }: { row: CustomerRow; onClose: () => void }) {
  const action = useRef(new IdempotentAction());
  const [credits, setCredits] = useState("10");
  const mutation = useConsoleMutation(async (reason: string) => {
    const request = { credits: Number(credits), reason };
    try {
      const result = await addCredits(row.subscription_id!, request, action.current.keyFor(request));
      action.current.settle();
      return result;
    } catch (error) { action.current.settle(error); throw error; }
  }, onClose);
  return (
    <ReasonDialog title={`Add credits · ${row.organization_name}`} confirmLabel="Add credits" busy={mutation.isPending} error={mutation.error}
      canConfirm={Number(credits) > 0} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Credits without a payment (a pilot, goodwill, or a manual refund after a software error). They are kept as top-up credits and do not expire at month end. For a paid top-up, use Record payment.</p>}>
      <label className="field">Credits<input inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} /></label>
    </ReasonDialog>
  );
}

function PlanDialog({ row, onClose }: { row: CustomerRow; onClose: () => void }) {
  const plans = useQuery({ queryKey: ["platform-admin", "plans"], queryFn: fetchPlans });
  const options = (plans.data ?? []).filter((plan) => plan.family === row.family);
  const [planKey, setPlanKey] = useState(row.plan_key ?? "");
  const [contract, setContract] = useState(false);
  const [credits, setCredits] = useState("");
  const [seats, setSeats] = useState("");
  const toNumber = (value: string) => (value.trim() === "" ? null : Number(value));
  const mutation = useConsoleMutation((reason: string) => changePlan(row.subscription_id!, {
    plan_key: planKey !== row.plan_key ? planKey : null, reason,
    ...(contract ? { overrides: { monthly_credits_override: toNumber(credits), seat_limit_override: toNumber(seats) } } : {}),
  }), onClose);
  const chosen = options.find((plan) => plan.key === planKey);
  return (
    <ReasonDialog title={`Change plan · ${row.organization_name}`} confirmLabel="Change plan" busy={mutation.isPending} error={mutation.error}
      canConfirm={planKey !== row.plan_key || contract} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>The new monthly allowance applies from next month. On an upgrade, this month's difference is added now.</p>}>
      <label className="field">Plan
        <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} disabled={plans.isPending}>
          {options.map((plan) => <option key={plan.key} value={plan.key}>{plan.name}{plan.is_internal ? " (internal, not sold)" : ` · ${tzs(plan.monthly_price)}`}</option>)}
        </select>
      </label>
      {chosen ? <p className="ari-sub">{chosen.limits.monthly_credits ?? "Contract"} credits a month · {chosen.limits.seat_limit ?? "contract"} users</p> : null}
      <label className="confirm-choice"><input type="checkbox" checked={contract} onChange={(e) => setContract(e.target.checked)} /> Set contract values (custom plans; empty means the plan's value)</label>
      {contract ? <div className="ari-grid">
        <label className="field">Credits a month<input inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="field">Users<input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))} /></label>
      </div> : null}
    </ReasonDialog>
  );
}

function SessionsDialog({ row, onClose }: { row: CustomerRow; onClose: () => void }) {
  const mutation = useConsoleMutation((reason: string) => endSessions(row.organization_id, { reason }), onClose);
  return (
    <ReasonDialog title={`End all sessions · ${row.organization_name}`} confirmLabel="End all sessions" tone="danger" busy={mutation.isPending}
      error={mutation.error} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Signs out every member of this customer on every device ({row.active_sessions} active now). They see "You were signed out by NOVA ARI" and can sign in again.</p>} />
  );
}

function StatusDialog({ row, target, onClose }: { row: CustomerRow; target: "suspended" | "active"; onClose: () => void }) {
  const mutation = useConsoleMutation((reason: string) => changeStatus(row.subscription_id!, { status: target, reason, change_ends_at: false }), onClose);
  return target === "suspended"
    ? <ReasonDialog title={`Suspend account · ${row.organization_name}`} confirmLabel="Suspend account" tone="danger" busy={mutation.isPending}
      error={mutation.error} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>New analyses stop at once ("Account suspended: contact NOVA ARI"). Members can still sign in, view and download their results.</p>} />
    : <ReasonDialog title={`Reactivate account · ${row.organization_name}`} confirmLabel="Reactivate" busy={mutation.isPending}
      error={mutation.error} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>New analyses are allowed again while credits remain.</p>} />;
}
