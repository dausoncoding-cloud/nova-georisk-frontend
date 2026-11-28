import { useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IdempotentAction } from "../../shared/api/idempotency";
import { Disclosure } from "../../shared/ui/Disclosure";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { Pagination } from "../../shared/ui/Pagination";
import { acknowledgeAlert, changeLimits, changePrice, closeRequest, fetchAlerts, fetchAudit, fetchMobileReviews, fetchPayments, fetchPlans, fetchRequests,
  resolveMobilePayment, reversePayment, type AdminPayment, type AdminPlan, type CustomerRequest, type MobilePayment, type SecurityAlert } from "./adminApi";
import { ReasonDialog } from "./ReasonDialog";
import { FAMILY_LABEL, dateTime, gigabytes, shortDate, tzs } from "./format";

const METHOD: Record<string, string> = { bank_transfer: "Bank transfer", mobile_money: "Mobile money", cash: "Cash", other: "Other" };
const PURPOSE: Record<string, string> = { plan_period: "Plan period", top_up: "Top-up", reversal: "Reversal", test: "Test payment (no credits)" };

function useRefresh() {
  const cache = useQueryClient();
  return () => void cache.invalidateQueries({ queryKey: ["platform-admin"] });
}

function PageHeader({ title, intro }: { title: string; intro: string }) {
  return <header className="ari-page__header"><div><h1>{title}</h1><p>{intro}</p></div></header>;
}

// --- Payments ------------------------------------------------------------------------------------

export function PaymentsPage() {
  const [offset, setOffset] = useState(0);
  const [reversing, setReversing] = useState<AdminPayment | null>(null);
  const list = useQuery({ queryKey: ["platform-admin", "payments", offset], queryFn: () => fetchPayments(offset), placeholderData: keepPreviousData });
  return (
    <div className="ari-page">
      <PageHeader title="Payments" intro="Payments recorded by NOVA ARI. A payment is never edited; a mistake is reversed with a reason." />
      <MobileReviews />
      <CustomerRequests />
      <section className="ari-card">
        {list.isPending ? <LoadingState label="Loading payments…" /> : list.isError ? <ErrorState title="Payments unavailable" error={list.error} /> : <>
          <div className="table-wrap"><table className="ari-table">
            <thead><tr><th scope="col">Paid on</th><th scope="col">Customer</th><th scope="col">For</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Recorded by</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>{list.data.items.map((payment) => (
              <tr key={payment.id} className={payment.reversed ? "is-muted" : undefined}>
                <td data-label="Paid on">{shortDate(payment.paid_on)}</td>
                <td data-label="Customer">{payment.organization_name}<div className="ari-sub">{payment.family ? FAMILY_LABEL[payment.family] : ""}</div></td>
                <td data-label="For">{PURPOSE[payment.purpose] ?? payment.purpose}
                  <div className="ari-sub">{payment.purpose === "plan_period" ? `${shortDate(payment.covers_from)} – ${shortDate(payment.covers_until)}` : payment.credits ? `${payment.credits} credits` : ""}{payment.reversed ? " · reversed" : ""}</div></td>
                <td data-label="Amount" className="ari-num">{tzs(payment.amount)}{payment.expected_amount != null && payment.expected_amount !== payment.amount ? <div className="ari-sub">List price {tzs(payment.expected_amount)}</div> : null}</td>
                <td data-label="Method">{METHOD[payment.method] ?? payment.method}<div className="ari-sub">{payment.reference}</div></td>
                <td data-label="Recorded by">{payment.recorded_by ?? "—"}{payment.note ? <Disclosure title="Note">{payment.note}</Disclosure> : null}</td>
                <td data-label="Actions">{payment.purpose !== "reversal" && !payment.reversed
                  ? <button type="button" className="button button--quiet button--small" onClick={() => setReversing(payment)}>Reverse</button> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {!list.data.items.length ? <p className="ari-empty">No payments recorded yet.</p> : null}
          <Pagination offset={offset} limit={50} total={list.data.total} onChange={setOffset} />
        </>}
      </section>
      {reversing ? <ReverseDialog payment={reversing} onClose={() => setReversing(null)} /> : null}
    </div>
  );
}

// Mobile Money (Abliner) payments in review: never credited automatically; an admin decides, with a reason.
function MobileReviews() {
  const reviews = useQuery({ queryKey: ["platform-admin", "mobile-reviews"], queryFn: fetchMobileReviews });
  const [resolving, setResolving] = useState<{ payment: MobilePayment; resolution: "credited_manually" | "no_action" } | null>(null);
  if (!reviews.data?.items.length) return null;
  return (
    <section className="ari-card" aria-labelledby="mobile-review-heading">
      <div className="ari-card__head"><h2 id="mobile-review-heading">Mobile Money payments to review <span className="ari-pill ari-pill--danger">{reviews.data.total}</span></h2>
        <span className="ari-sub">No credits were added. If the customer paid, record the payment for them first, then mark it credited.</span></div>
      <div className="table-wrap"><table className="ari-table">
        <thead><tr><th scope="col">Started</th><th scope="col">Customer</th><th scope="col">For</th><th scope="col">Why</th><th scope="col">Abliner</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{reviews.data.items.map((payment) => (
          <tr key={payment.id}>
            <td data-label="Started">{dateTime(payment.created_at)}<div className="ari-sub">{payment.phone}</div></td>
            <td data-label="Customer">{payment.organization_name}<div><span className="ari-pill ari-pill--danger">Review</span></div></td>
            <td data-label="For" className="ari-num">{tzs(payment.amount)}<div className="ari-sub">{payment.purpose === "top_up" ? `Top-up · ${payment.credits} credits` : "Plan renewal"}</div></td>
            <td data-label="Why">{payment.review_reason}</td>
            <td data-label="Abliner"><span className="break-anywhere">{payment.abliner_event_tx_id ?? payment.abliner_tx_id ?? "—"}</span><div className="ari-sub">{payment.reference}</div></td>
            <td data-label="Actions"><div className="row-links">
              <button type="button" className="button button--quiet button--small" onClick={() => setResolving({ payment, resolution: "credited_manually" })}>Mark credited</button>
              <button type="button" className="button button--quiet button--small" onClick={() => setResolving({ payment, resolution: "no_action" })}>No action</button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div>
      {resolving ? <ResolveDialog {...resolving} onClose={() => setResolving(null)} /> : null}
    </section>
  );
}

function ResolveDialog({ payment, resolution, onClose }: { payment: MobilePayment; resolution: "credited_manually" | "no_action"; onClose: () => void }) {
  const refresh = useRefresh();
  const mutation = useMutation({ mutationFn: (reason: string) => resolveMobilePayment(payment.id, { resolution, reason }), onSuccess: () => { refresh(); onClose(); } });
  return (
    <ReasonDialog title={`${resolution === "credited_manually" ? "Mark credited" : "No action"} · ${payment.organization_name}`}
      confirmLabel={resolution === "credited_manually" ? "Mark credited" : "Close without credit"} busy={mutation.isPending} error={mutation.error}
      onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={resolution === "credited_manually"
        ? <p>This closes the review only. Record the payment for {payment.organization_name} in the console first if they should receive credits.</p>
        : <p>Close this review without adding anything. Say what you checked.</p>} />
  );
}

// "Request top-up" / "Request upgrade" from customers' My subscription page.
function CustomerRequests() {
  const requests = useQuery({ queryKey: ["platform-admin", "requests"], queryFn: fetchRequests });
  const [closing, setClosing] = useState<{ request: CustomerRequest; outcome: "done" | "declined" } | null>(null);
  if (!requests.data?.items.length) return null;
  return (
    <section className="ari-card" aria-labelledby="requests-heading">
      <div className="ari-card__head"><h2 id="requests-heading">Requests from customers</h2>
        <span className="ari-sub">Record the payment or change the plan first, then mark the request done.</span></div>
      <div className="table-wrap"><table className="ari-table">
        <thead><tr><th scope="col">Requested</th><th scope="col">Customer</th><th scope="col">Request</th><th scope="col">By</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{requests.data.items.map((request) => (
          <tr key={request.id}>
            <td data-label="Requested">{dateTime(request.created_at)}</td>
            <td data-label="Customer">{request.organization_name}<div className="ari-sub">{request.current_plan}</div></td>
            <td data-label="Request">{request.kind === "top_up" ? `Top-up: ${request.credits} credits` : `Upgrade to ${request.plan_name ?? request.plan_key}`}</td>
            <td data-label="By">{request.requested_by ?? "—"}</td>
            <td data-label="Actions"><div className="row-links">
              <button type="button" className="button button--quiet button--small" onClick={() => setClosing({ request, outcome: "done" })}>Done</button>
              <button type="button" className="button button--quiet button--small" onClick={() => setClosing({ request, outcome: "declined" })}>Decline</button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div>
      {closing ? <CloseRequestDialog {...closing} onClose={() => setClosing(null)} /> : null}
    </section>
  );
}

function CloseRequestDialog({ request, outcome, onClose }: { request: CustomerRequest; outcome: "done" | "declined"; onClose: () => void }) {
  const refresh = useRefresh();
  const mutation = useMutation({ mutationFn: (reason: string) => closeRequest(request.id, { outcome, reason }), onSuccess: () => { refresh(); onClose(); } });
  return (
    <ReasonDialog title={`${outcome === "done" ? "Mark done" : "Decline"} · ${request.organization_name}`} confirmLabel={outcome === "done" ? "Mark done" : "Decline request"}
      tone={outcome === "done" ? "primary" : "danger"} busy={mutation.isPending} error={mutation.error} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>The customer sees the request as {outcome === "done" ? "done" : "declined"} on their subscription page.</p>} />
  );
}

function ReverseDialog({ payment, onClose }: { payment: AdminPayment; onClose: () => void }) {
  const refresh = useRefresh();
  const action = useRef(new IdempotentAction());
  const mutation = useMutation({
    mutationFn: async (reason: string) => {
      try {
        const result = await reversePayment(payment.id, reason, action.current.keyFor({ payment: payment.id, reason }));
        action.current.settle();
        return result;
      } catch (error) { action.current.settle(error); throw error; }
    },
    onSuccess: () => { refresh(); onClose(); },
  });
  return (
    <ReasonDialog title={`Reverse payment · ${payment.organization_name}`} confirmLabel="Reverse payment" tone="danger" busy={mutation.isPending}
      error={mutation.error} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Records a negative payment of {tzs(-payment.amount)}.{payment.purpose === "top_up" ? ` The ${payment.credits} top-up credits are removed as far as they are unspent.` : ""}</p>} />
  );
}

// --- Plans and pricing ---------------------------------------------------------------------------

export function PlansPage() {
  const plans = useQuery({ queryKey: ["platform-admin", "plans"], queryFn: fetchPlans });
  const [editing, setEditing] = useState<{ plan: AdminPlan; kind: "price" | "limits" } | null>(null);
  return (
    <div className="ari-page">
      <PageHeader title="Plans and pricing" intro="Prices are versioned: a change adds a new version and earlier ones are kept. Limit changes apply to every subscription on the plan (contract values still win)." />
      {plans.isPending ? <LoadingState label="Loading plans…" /> : plans.isError ? <ErrorState title="Plans unavailable" error={plans.error} /> :
        Object.entries(FAMILY_LABEL).map(([family, label]) => (
          <section key={family} className="ari-card" aria-label={label}>
            <div className="ari-card__head"><h2>{label}</h2></div>
            <div className="table-wrap"><table className="ari-table">
              <thead><tr><th scope="col">Plan</th><th scope="col">Price / month</th><th scope="col">Users</th><th scope="col">Credits / month</th><th scope="col">Storage</th><th scope="col">Sessions per user</th><th scope="col">Top-up credit</th><th scope="col">Customers</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>{plans.data.filter((plan) => plan.family === family).map((plan) => (
                <tr key={plan.key}>
                  <td data-label="Plan">{plan.name}{plan.is_internal ? <div className="ari-sub">Internal · not sold, hidden from customers</div> : null}</td>
                  <td data-label="Price" className="ari-num">{plan.is_internal ? "—" : tzs(plan.monthly_price)}{plan.price_version ? <div className="ari-sub">v{plan.price_version}</div> : null}</td>
                  <td data-label="Users" className="ari-num">{plan.limits.seat_limit ?? "Contract"}</td>
                  <td data-label="Credits" className="ari-num">{plan.unlimited_credits ? "Unlimited" : plan.limits.monthly_credits ?? "Contract"}</td>
                  <td data-label="Storage" className="ari-num">{plan.limits.storage_bytes == null ? "—" : gigabytes(plan.limits.storage_bytes, 0)}</td>
                  <td data-label="Sessions" className="ari-num">{plan.limits.session_limit ?? "No limit"}</td>
                  <td data-label="Top-up" className="ari-num">{plan.top_up_credit_price == null ? "Not offered" : tzs(plan.top_up_credit_price)}</td>
                  <td data-label="Customers" className="ari-num">{plan.subscriptions}</td>
                  <td data-label="Actions"><div className="row-links">
                    {!plan.is_internal ? <button type="button" className="button button--quiet button--small" onClick={() => setEditing({ plan, kind: "price" })}>Change price</button> : null}
                    <button type="button" className="button button--quiet button--small" onClick={() => setEditing({ plan, kind: "limits" })}>Change limits</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        ))}
      {editing?.kind === "price" ? <PriceDialog plan={editing.plan} onClose={() => setEditing(null)} /> : null}
      {editing?.kind === "limits" ? <LimitsDialog plan={editing.plan} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

const digits = (value: string) => value.replace(/\D/g, "");
const orNull = (value: string) => (value === "" ? null : Number(value));

function PriceDialog({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
  const refresh = useRefresh();
  const [monthly, setMonthly] = useState(plan.monthly_price?.toString() ?? "");
  const [topUp, setTopUp] = useState(plan.top_up_credit_price?.toString() ?? "");
  const mutation = useMutation({
    mutationFn: (reason: string) => changePrice(plan.key, { monthly_price: orNull(monthly), top_up_credit_price: orNull(topUp), reason }),
    onSuccess: () => { refresh(); onClose(); },
  });
  return (
    <ReasonDialog title={`New price · ${plan.name}`} confirmLabel="Save new price version" busy={mutation.isPending} error={mutation.error}
      onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Takes effect now as version {(plan.price_version ?? 0) + 1}. Empty monthly price means a contract price; empty top-up price means no top-ups.</p>}>
      <div className="ari-grid">
        <label className="field">Monthly price (TZS)<input inputMode="numeric" value={monthly} onChange={(e) => setMonthly(digits(e.target.value))} /></label>
        <label className="field">Top-up price per credit (TZS)<input inputMode="numeric" value={topUp} onChange={(e) => setTopUp(digits(e.target.value))} /></label>
      </div>
    </ReasonDialog>
  );
}

function LimitsDialog({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
  const refresh = useRefresh();
  const initial = {
    seat_limit: plan.limits.seat_limit?.toString() ?? "", monthly_credits: plan.limits.monthly_credits?.toString() ?? "",
    storage_gb: plan.limits.storage_bytes == null ? "" : String(plan.limits.storage_bytes / 1e9), session_limit: plan.limits.session_limit?.toString() ?? "",
  };
  const [values, setValues] = useState(initial);
  const [refund, setRefund] = useState(plan.refund_on_data_failure);
  const changed = (Object.keys(initial) as (keyof typeof initial)[]).filter((name) => values[name] !== initial[name]);
  const mutation = useMutation({
    mutationFn: (reason: string) => {
      const fields = changed.map((name) => (name === "storage_gb" ? "storage_bytes" : name)) as ("seat_limit" | "monthly_credits" | "storage_bytes" | "session_limit" | "refund_on_data_failure")[];
      if (refund !== plan.refund_on_data_failure) fields.push("refund_on_data_failure");
      return changeLimits(plan.key, {
        fields, reason, refund_on_data_failure: refund, seat_limit: orNull(values.seat_limit), monthly_credits: orNull(values.monthly_credits),
        session_limit: orNull(values.session_limit), storage_bytes: values.storage_gb === "" ? null : Math.round(Number(values.storage_gb) * 1e9),
      });
    },
    onSuccess: () => { refresh(); onClose(); },
  });
  const field = (name: keyof typeof initial, label: string) => (
    <label className="field">{label}<input inputMode="decimal" value={values[name]} onChange={(e) => setValues((current) => ({ ...current, [name]: e.target.value.replace(/[^\d.]/g, "") }))} /></label>
  );
  return (
    <ReasonDialog title={`Change limits · ${plan.name}`} confirmLabel="Save limits" busy={mutation.isPending} error={mutation.error}
      canConfirm={changed.length > 0 || refund !== plan.refund_on_data_failure} onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Applies to all {plan.subscriptions} customers on this plan. Empty means no limit (or the contract value).</p>}>
      <div className="ari-grid">
        {field("seat_limit", "Users")}{field("monthly_credits", "Credits a month")}{field("storage_gb", "Storage (GB)")}{field("session_limit", "Sessions per user")}
      </div>
      <label className="confirm-choice"><input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} /> Refund 1 credit when a run fails for data reasons</label>
    </ReasonDialog>
  );
}

// --- Security alerts -----------------------------------------------------------------------------

export function SecurityAlertsPage() {
  const [state, setState] = useState<"open" | "all">("open");
  const [offset, setOffset] = useState(0);
  const [reviewing, setReviewing] = useState<SecurityAlert | null>(null);
  const alerts = useQuery({ queryKey: ["platform-admin", "alerts", state, offset], queryFn: () => fetchAlerts(state, offset), placeholderData: keepPreviousData });
  return (
    <div className="ari-page">
      <PageHeader title="Security alerts" intro="Sign-ins from a browser and system a user has not used before. Review each one with the customer if it looks unexpected." />
      <section className="ari-card">
        <div className="ari-card__head">
          <h2>{state === "open" ? "Open alerts" : "All alerts"}</h2>
          <label className="field">Show<select value={state} onChange={(e) => { setState(e.target.value as "open" | "all"); setOffset(0); }}><option value="open">Open</option><option value="all">All</option></select></label>
        </div>
        {alerts.isPending ? <LoadingState label="Loading alerts…" /> : alerts.isError ? <ErrorState title="Alerts unavailable" error={alerts.error} /> : <>
          <div className="table-wrap"><table className="ari-table">
            <thead><tr><th scope="col">When</th><th scope="col">Customer</th><th scope="col">User</th><th scope="col">Device</th><th scope="col">Location</th><th scope="col">Review</th></tr></thead>
            <tbody>{alerts.data.items.map((alert) => {
              const detail = (alert.detail ?? {}) as Record<string, string | null>;
              return (
                <tr key={alert.id}>
                  <td data-label="When">{dateTime(alert.created_at)}</td>
                  <td data-label="Customer">{alert.organization_name}</td>
                  <td data-label="User">{alert.user_display_name ?? alert.user_email}</td>
                  <td data-label="Device">New device: {detail.browser}, {detail.os}</td>
                  <td data-label="Location">{[detail.city, detail.country].filter(Boolean).join(", ") || "Unknown"}</td>
                  <td data-label="Review">{alert.acknowledged_at
                    ? <span className="ari-sub">Reviewed {shortDate(alert.acknowledged_at)} by {alert.acknowledged_by}: {alert.acknowledge_reason}</span>
                    : <button type="button" className="button button--quiet button--small" onClick={() => setReviewing(alert)}>Mark reviewed</button>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          {!alerts.data.items.length ? <p className="ari-empty">{state === "open" ? "No open alerts." : "No alerts yet."}</p> : null}
          <Pagination offset={offset} limit={50} total={alerts.data.total} onChange={setOffset} />
        </>}
      </section>
      {reviewing ? <ReviewDialog alert={reviewing} onClose={() => setReviewing(null)} /> : null}
    </div>
  );
}

function ReviewDialog({ alert, onClose }: { alert: SecurityAlert; onClose: () => void }) {
  const refresh = useRefresh();
  const mutation = useMutation({ mutationFn: (reason: string) => acknowledgeAlert(alert.id, reason), onSuccess: () => { refresh(); onClose(); } });
  return (
    <ReasonDialog title={`Review alert · ${alert.organization_name}`} confirmLabel="Mark reviewed" busy={mutation.isPending} error={mutation.error}
      onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Record what you checked (for example "Confirmed with the customer: new office PC"). To stop access, end the user's sessions from the customer page.</p>} />
  );
}

// --- Audit log -----------------------------------------------------------------------------------

export function AuditLogPage() {
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const log = useQuery({ queryKey: ["platform-admin", "audit", action, q, offset], queryFn: () => fetchAudit({ action, q, offset }), placeholderData: keepPreviousData });
  return (
    <div className="ari-page">
      <PageHeader title="Audit log" intro="Every NOVA ARI action, with who did it, why, and the values before and after. Entries cannot be edited or deleted." />
      <section className="ari-card">
        <div className="ari-card__head">
          <h2>Entries</h2>
          <div className="ari-filters">
            <label className="field">Action
              <select value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }}>
                <option value="">All</option>
                {[["subscription", "Subscriptions"], ["payment", "Payments"], ["credits", "Credits"], ["sessions", "Sessions"], ["organization", "Customers"],
                  ["plan", "Plans and prices"], ["security_alert", "Security alerts"], ["platform_admin", "Admin role"], ["view", "Views"]]
                  .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">Search<input type="search" placeholder="Reason or admin" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} /></label>
          </div>
        </div>
        {log.isPending ? <LoadingState label="Loading audit log…" /> : log.isError ? <ErrorState title="Audit log unavailable" error={log.error} /> : <>
          <div className="table-wrap"><table className="ari-table">
            <thead><tr><th scope="col">When</th><th scope="col">Admin</th><th scope="col">Action</th><th scope="col">Customer</th><th scope="col">Reason</th><th scope="col">Change</th></tr></thead>
            <tbody>{log.data.items.map((entry) => (
              <tr key={entry.id}>
                <td data-label="When">{dateTime(entry.created_at)}</td>
                <td data-label="Admin">{entry.actor ?? "—"}</td>
                <td data-label="Action"><code>{entry.action}</code></td>
                <td data-label="Customer">{entry.organization_name ?? "—"}</td>
                <td data-label="Reason">{entry.reason}</td>
                <td data-label="Change"><Disclosure title="Before and after"><span className="break-anywhere">
                  Before: <code>{JSON.stringify(entry.previous)}</code><br />After: <code>{JSON.stringify(entry.current)}</code><br />Request: {entry.request_id ?? "—"}
                </span></Disclosure></td>
              </tr>
            ))}</tbody>
          </table></div>
          {!log.data.items.length ? <p className="ari-empty">No entries match.</p> : null}
          <Pagination offset={offset} limit={50} total={log.data.total} onChange={setOffset} />
        </>}
      </section>
    </div>
  );
}
