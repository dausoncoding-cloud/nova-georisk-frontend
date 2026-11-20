import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FRRIS_ROUTES } from "../../app/routes";
import { getErrorMessage } from "../../shared/api/errors";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { useOrganizationContext } from "../organization/OrganizationContext";
import { SubscriptionBanner } from "./SubscriptionNotices";
import {
  FAMILY_NAME, SYSTEM_NAME, fetchDevices, fetchLedger, fetchLogins, fetchPayments, fetchPlans, fetchRequests,
  sendRequest, signOutDevice, subscriptionKeys, useBillingSummary, type LedgerEntry, type Subscription,
} from "./subscriptionApi";

const GB = 1_000_000_000;
const gb = (bytes: number | null | undefined) => (bytes == null ? "—" : `${Number((bytes / GB).toFixed(bytes < 10 * GB ? 1 : 0))} GB`);
const day = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const time = (value: string) => new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const money = (value: number | null | undefined) => (value == null ? "Contract" : value.toLocaleString("en-GB"));
const STATUS: Record<string, string> = { active: "Active", trial: "Trial", suspended: "Suspended", expired: "Expired", canceled: "Cancelled", pending: "Pending" };
const RESULT: Record<string, string> = { active: "Signed in", signed_out: "Signed out", replaced: "Ended by a newer sign-in", ended_by_user: "Signed out from another device", ended_by_admin: "Signed out by NOVA ARI", expired: "Expired" };

function activity(entry: LedgerEntry): string {
  switch (entry.kind) {
    case "charge": return ["Analysis", entry.aoi_name ?? entry.project_name].filter(Boolean).join(" · ");
    case "refund": return `Refund · ${entry.reason ?? "analysis stopped"}`;
    case "monthly_grant": return `Monthly allowance${entry.plan_name ? ` · ${entry.plan_name} plan` : ""}`;
    case "top_up": return `Top-up · ${entry.amount} credits${entry.reason ? ` · ${entry.reason}` : ""}`;
    case "expiry": return "Unused monthly credits expired";
    default: return `Adjustment${entry.reason ? ` · ${entry.reason}` : ""}`;
  }
}

export function SubscriptionPage() {
  const summary = useBillingSummary();
  const location = useLocation();
  const organization = useOrganizationContext();
  const canManage = ["owner", "admin"].includes(organization.current_role);
  const subscriptions = summary.data?.subscriptions ?? [];
  const [familyChoice, setFamilyChoice] = useState<string | null>(null);
  const subscription = subscriptions.find((item) => item.family === familyChoice) ?? subscriptions[0];
  useEffect(() => { // #top-up / #plans links from the banner and the buttons
    if (!location.hash || !summary.isSuccess) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [location.hash, summary.isSuccess]);

  if (summary.isPending) return <LoadingState label="Loading your subscription…" />;
  if (summary.isError) return <ErrorState title="Subscription unavailable" error={summary.error} onRetry={() => void summary.refetch()} />;
  if (!subscription) {
    return <div className="sub-page"><header className="sub-page__header"><div><h1>My subscription</h1><p>This organisation has no subscription yet. Contact NOVA ARI.</p></div></header></div>;
  }
  return (
    <div className="sub-page">
      <header className="sub-page__header">
        <div><h1>My subscription</h1><p>Your plan, analysis credits and usage for the current period.</p></div>
        <a className="fr-button fr-button--secondary" href="#plans">Compare plans</a>
      </header>
      {subscriptions.length > 1 ? (
        <div className="sub-tabs" role="tablist" aria-label="System">
          {subscriptions.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === subscription.id} onClick={() => setFamilyChoice(item.family)}>{FAMILY_NAME[item.family] ?? item.family}</button>
          ))}
        </div>
      ) : null}
      <SubscriptionBanner engine={subscription.engines[0] ?? "firris"} onPage />
      <div className="sub-grid">
        <PlanCard subscription={subscription} seatsUsed={summary.data.seats.used} storage={summary.data.storage} />
        <CreditsCard subscription={subscription} />
      </div>
      <CreditActivity family={subscription.family} />
      <div className="sub-grid">
        <TopUpCard subscription={subscription} canManage={canManage} />
        <SessionsCard subscription={subscription} />
      </div>
      <PlansTable subscription={subscription} canManage={canManage} />
      <LoginHistory />
      {canManage ? <Payments /> : null}
    </div>
  );
}

function PlanCard({ subscription, seatsUsed, storage }: { subscription: Subscription; seatsUsed: number; storage: { used: number; limit?: number | null } }) {
  const devices = useQuery({ queryKey: subscriptionKeys.devices, queryFn: fetchDevices });
  const status = subscription.status;
  return (
    <section className="sub-card" aria-labelledby="plan-heading">
      <div className="sub-card__top">
        <span className="sub-eyebrow">Current plan</span>
        <span className={`sub-pill sub-pill--${status === "active" ? "success" : status === "suspended" ? "neutral" : "danger"}`}><span aria-hidden="true">●</span> {STATUS[status] ?? status}</span>
      </div>
      <h2 id="plan-heading" className="sub-plan-name">{SYSTEM_NAME[subscription.family] ?? ""} {subscription.plan_name ?? "Plan"}</h2>
      <p className="sub-mono">{subscription.is_internal ? "Internal plan" : subscription.monthly_price == null ? "Contract price" : `${subscription.currency} ${money(subscription.monthly_price)} / month`}</p>
      <dl className="sub-facts">
        <div><dt>Authorised users</dt><dd>{subscription.limits.seat_limit == null ? seatsUsed : `${seatsUsed} of ${subscription.limits.seat_limit}`}</dd></div>
        <div><dt>Active sessions</dt><dd>{devices.data ? `${devices.data.items.length}${devices.data.session_limit ? ` / ${devices.data.session_limit}` : ""}` : "—"}</dd></div>
        <div><dt>Storage</dt><dd>{gb(storage.used)}{storage.limit != null ? ` of ${gb(storage.limit)}` : ""}</dd></div>
        <div><dt>{subscription.ends_at && subscription.renews_on === subscription.ends_at ? "Ends on" : "Renews on"}</dt><dd>{day(subscription.renews_on ?? subscription.ends_at)}</dd></div>
      </dl>
    </section>
  );
}

function CreditsCard({ subscription }: { subscription: Subscription }) {
  const credits = subscription.credits;
  const percent = credits.unlimited ? 0 : Math.min(100, credits.used_percent);
  const tone = credits.level === 100 ? " is-full" : credits.level ? " is-warning" : "";
  return (
    <section className="sub-card" aria-labelledby="credits-heading">
      <span className="sub-eyebrow" id="credits-heading">Analysis credits this period</span>
      {credits.unlimited
        ? <p className="sub-credits"><strong>{credits.used}</strong> analyses · Internal plan, no credit limit</p>
        : <>
          <p className="sub-credits"><strong>{credits.used}</strong> / {credits.available} credits used</p>
          <div className="sub-meter" role="progressbar" aria-label="Credits used" aria-valuemin={0} aria-valuemax={credits.available} aria-valuenow={credits.used}>
            <div className={`sub-meter__bar${tone}`} style={{ width: `${percent}%` }} />
          </div>
          <p className="sub-credits__foot"><span><strong>{credits.remaining}</strong> credits remaining</span><span>Warnings at {subscription.warning_levels.map((level) => `${level}%`).join(" and ")}</span></p>
        </>}
      <div className="sub-actions">
        {subscription.can_submit
          ? <Link className="fr-button fr-button--primary" to={FRRIS_ROUTES.newAnalysis}>Run new analysis</Link>
          : <button type="button" className="fr-button fr-button--primary" disabled>Run new analysis</button>}
        <a className="fr-button fr-button--secondary" href="#top-up">Buy credits</a>
        <a className="fr-button fr-button--secondary" href="#plans">Upgrade plan</a>
      </div>
    </section>
  );
}

function CreditActivity({ family }: { family: string }) {
  const ledger = useQuery({ queryKey: subscriptionKeys.ledger(family), queryFn: () => fetchLedger(family) });
  return (
    <section className="sub-card sub-card--table" aria-labelledby="activity-heading">
      <div className="sub-card__head"><h2 id="activity-heading">Credit activity</h2><span className="sub-muted">Signing in and viewing results never uses credits.</span></div>
      {ledger.isPending ? <LoadingState label="Loading credit activity…" /> : ledger.isError ? <ErrorState title="Credit activity unavailable" error={ledger.error} /> :
        ledger.data.items.length ? (
          <div className="table-wrap"><table className="sub-table">
            <thead><tr><th scope="col">Date</th><th scope="col">Activity</th><th scope="col" className="sub-num">Credits</th><th scope="col" className="sub-num">Balance</th></tr></thead>
            <tbody>{ledger.data.items.map((entry) => (
              <tr key={entry.id}>
                <td data-label="Date">{day(entry.created_at)}</td>
                <td data-label="Activity">{entry.task_id && entry.kind === "charge" ? <Link to={`/tasks/${entry.task_id}`}>{activity(entry)}</Link> : activity(entry)}</td>
                <td data-label="Credits" className={`sub-num ${entry.amount < 0 ? "sub-minus" : "sub-plus"}`}>{entry.amount > 0 ? `+${entry.amount}` : `−${Math.abs(entry.amount)}`}</td>
                <td data-label="Balance" className="sub-num">{entry.balance_after}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="sub-muted sub-empty">No credit activity yet this period.</p>}
    </section>
  );
}

function useRequest() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: sendRequest, onSuccess: () => void cache.invalidateQueries({ queryKey: subscriptionKeys.requests }) });
}

function TopUpCard({ subscription, canManage }: { subscription: Subscription; canManage: boolean }) {
  const requests = useQuery({ queryKey: subscriptionKeys.requests, queryFn: fetchRequests, enabled: canManage });
  const request = useRequest();
  const open = requests.data?.find((item) => item.subscription_id === subscription.id && item.kind === "top_up" && item.status === "open");
  const offer = subscription.top_up;
  return (
    <section className="sub-card" id="top-up" aria-labelledby="topup-heading">
      <h2 id="topup-heading">Buy additional credits</h2>
      <p className="sub-muted">Add credits without changing your plan. They are added to this period's balance once payment is confirmed, and they do not expire at month end.</p>
      {offer && !subscription.is_internal ? <>
        <div className="sub-offer">
          <div><strong>{offer.credits} credits</strong><span className="sub-mono">{offer.currency} {money(offer.price)}</span></div>
          {canManage
            ? <button type="button" className="fr-button fr-button--primary" disabled={!!open || request.isPending}
              onClick={() => request.mutate({ subscription_id: subscription.id, kind: "top_up" })}>{open ? "Requested" : request.isPending ? "Sending…" : "Request top-up"}</button>
            : null}
        </div>
        {open ? <p className="sub-ok" role="status">Requested on {day(open.created_at)}. NOVA ARI will send payment details to the account owner.</p> : null}
        {request.isError ? <p className="inline-alert" role="alert">{getErrorMessage(request.error)}</p> : null}
        <p className="sub-muted sub-small">{canManage ? "Payment details are sent to the account owner. No payment is taken in NOVA-GeoRisk." : "Ask your organisation's owner or admin to request a top-up."}</p>
      </> : <p className="sub-muted">{subscription.is_internal ? "The Internal plan has no credit limit." : "Top-ups are not offered for this plan yet. Contact NOVA ARI."}</p>}
    </section>
  );
}

function SessionsCard({ subscription }: { subscription: Subscription }) {
  const cache = useQueryClient();
  const devices = useQuery({ queryKey: subscriptionKeys.devices, queryFn: fetchDevices });
  const signOut = useMutation({ mutationFn: signOutDevice, onSuccess: () => void cache.invalidateQueries({ queryKey: ["account"] }) });
  const sessions = subscription.limits.session_limit;
  const seats = subscription.limits.seat_limit;
  const rule = sessions == null ? `The ${subscription.plan_name} plan has no session limit.`
    : `The ${subscription.plan_name} plan allows ${sessions === 1 ? "one active session" : `${sessions} active sessions`} for ${seats === 1 ? "one authorised user" : "each authorised user"}.`;
  return (
    <section className="sub-card" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading">Your sessions</h2>
      <p className="sub-muted">{rule}</p>
      {devices.isPending ? <LoadingState label="Loading your sessions…" /> : devices.isError ? <ErrorState title="Sessions unavailable" error={devices.error} /> : (
        <ul className="sub-devices">
          {devices.data.items.map((device) => (
            <li key={device.id}>
              <div>
                <strong>{device.current ? "This device · " : ""}{device.browser}, {device.os}</strong>
                <span className="sub-muted">Signed in {time(device.created_at)}{device.location ? ` · ${device.location} (approximate)` : ""}</span>
              </div>
              {device.current ? <span className="sub-ok">Current</span>
                : <button type="button" className="fr-button fr-button--secondary fr-button--small" disabled={signOut.isPending} onClick={() => signOut.mutate(device.id)}>Sign out</button>}
            </li>
          ))}
          {!devices.data.items.length ? <li className="sub-muted">No active sessions recorded.</li> : null}
        </ul>
      )}
      {devices.data?.location_attribution ? <p className="sub-muted sub-small">Locations are approximate. {devices.data.location_attribution}.</p> : null}
      {signOut.isError ? <p className="inline-alert" role="alert">{getErrorMessage(signOut.error)}</p> : null}
    </section>
  );
}

function PlansTable({ subscription, canManage }: { subscription: Subscription; canManage: boolean }) {
  const family = subscription.family as "frris_wrris" | "megis";
  const plans = useQuery({ queryKey: subscriptionKeys.plans(family), queryFn: () => fetchPlans(family) });
  const requests = useQuery({ queryKey: subscriptionKeys.requests, queryFn: fetchRequests, enabled: canManage });
  const request = useRequest();
  const openUpgrade = requests.data?.find((item) => item.subscription_id === subscription.id && item.kind === "upgrade" && item.status === "open");
  return (
    <section className="sub-card sub-card--table" id="plans" aria-labelledby="plans-heading">
      <div className="sub-card__head"><h2 id="plans-heading">Plans for {FAMILY_NAME[family] ?? family}</h2>
        {openUpgrade ? <span className="sub-ok" role="status">Upgrade to {openUpgrade.plan_name} requested on {day(openUpgrade.created_at)}</span> : null}</div>
      {plans.isPending ? <LoadingState label="Loading plans…" /> : plans.isError ? <ErrorState title="Plans unavailable" error={plans.error} /> : (
        <div className="table-wrap"><table className="sub-table">
          <thead><tr><th scope="col">Plan</th><th scope="col">Monthly ({plans.data.plans[0]?.currency ?? "TZS"})</th><th scope="col">Users</th><th scope="col">Credits / month</th><th scope="col">Storage</th><th scope="col"><span className="visually-hidden">Action</span></th></tr></thead>
          <tbody>{plans.data.plans.map((plan) => {
            const current = plan.key === subscription.plan_key;
            return (
              <tr key={plan.key} className={current ? "is-current" : undefined}>
                <th scope="row">{plan.name}</th>
                <td data-label="Monthly" className="sub-mono">{money(plan.monthly_price)}</td>
                <td data-label="Users">{plan.limits.seat_limit == null ? "Per contract" : plan.limits.seat_limit === 1 ? "1" : `Up to ${plan.limits.seat_limit}`}</td>
                <td data-label="Credits / month">{plan.limits.monthly_credits ?? "Per contract"}</td>
                <td data-label="Storage">{gb(plan.limits.storage_bytes)}</td>
                <td data-label="Action">{current ? <span className="sub-current">Current plan</span>
                  : canManage ? <button type="button" className="sub-link" disabled={!!openUpgrade || request.isPending}
                    onClick={() => request.mutate({ subscription_id: subscription.id, kind: "upgrade", plan_key: plan.key })}>{plan.is_custom ? "Contact NOVA ARI" : "Request upgrade"}</button>
                    : null}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {request.isError ? <p className="inline-alert" role="alert">{getErrorMessage(request.error)}</p> : null}
      {!canManage ? <p className="sub-muted sub-small">Plan changes are requested by your organisation's owner or admin.</p> : null}
    </section>
  );
}

function LoginHistory() {
  const logins = useQuery({ queryKey: subscriptionKeys.logins, queryFn: fetchLogins });
  return (
    <section className="sub-card sub-card--table" aria-labelledby="logins-heading">
      <div className="sub-card__head"><h2 id="logins-heading">Your sign-ins</h2><span className="sub-muted">Approximate location</span></div>
      {logins.isPending ? <LoadingState label="Loading sign-ins…" /> : logins.isError ? <ErrorState title="Sign-ins unavailable" error={logins.error} /> : (
        <div className="table-wrap"><table className="sub-table">
          <thead><tr><th scope="col">When</th><th scope="col">Device</th><th scope="col">Location</th><th scope="col">Result</th></tr></thead>
          <tbody>{logins.data.items.map((entry) => (
            <tr key={entry.id}><td data-label="When">{time(entry.created_at)}</td><td data-label="Device">{entry.browser}, {entry.os}</td>
              <td data-label="Location">{entry.location ?? "Unknown"}</td><td data-label="Result">{RESULT[entry.result] ?? entry.result}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

function Payments() {
  const payments = useQuery({ queryKey: subscriptionKeys.payments, queryFn: fetchPayments });
  if (!payments.data?.items.length) return null;
  return (
    <section className="sub-card sub-card--table" aria-labelledby="payments-heading">
      <div className="sub-card__head"><h2 id="payments-heading">Payments</h2><span className="sub-muted">Recorded by NOVA ARI</span></div>
      <div className="table-wrap"><table className="sub-table">
        <thead><tr><th scope="col">Paid on</th><th scope="col">For</th><th scope="col" className="sub-num">Amount</th><th scope="col">Reference</th></tr></thead>
        <tbody>{payments.data.items.map((payment) => (
          <tr key={payment.id}>
            <td data-label="Paid on">{day(payment.paid_on)}</td>
            <td data-label="For">{payment.purpose === "plan_period" ? `Plan · ${day(payment.covers_from)} to ${day(payment.covers_until)}` : payment.purpose === "top_up" ? `Top-up · ${payment.credits} credits` : "Reversal"}{payment.reversed ? " (reversed)" : ""}</td>
            <td data-label="Amount" className="sub-num">{payment.currency} {payment.amount.toLocaleString("en-GB")}</td>
            <td data-label="Reference">{payment.reference ?? "—"}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}
