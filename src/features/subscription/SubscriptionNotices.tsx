import { Link, useLocation } from "react-router-dom";
import "./subscription.css";
import { subscriptionFor, useBillingSummary, useCreditStatus, type Subscription } from "./subscriptionApi";

const WARN = (subscription: Subscription) =>
  `You have used ${subscription.credits.used} of ${subscription.credits.available} analysis credits this month (${subscription.credits.level}%). ${subscription.credits.remaining} remaining.`;

/** Board 13 "limit reached" banner, and the 75% / 90% warnings, for every member (only while limits are enforced). */
export function SubscriptionBanner({ engine = "firris", onPage = false }: { engine?: string; onPage?: boolean }) {
  const summary = useBillingSummary();
  const location = useLocation();
  if (!onPage && location.pathname.startsWith("/subscription")) return null; // the page shows its own
  const subscription = subscriptionFor(summary.data, engine);
  if (!summary.data?.enforcement_enabled || !subscription) return null;
  if (subscription.block_code) {
    const credits = subscription.block_code === "credits_exhausted";
    const storage = subscription.block_code === "storage_full";
    const ended = subscription.block_code === "subscription_expired" || subscription.block_code === "subscription_canceled";
    return (
      <div className="sub-banner sub-banner--danger" role="alert">
        <p><span className="sub-banner__icon" aria-hidden="true">!</span>{subscription.block_message}
          {ended && subscription.access_ends_at ? ` Viewing and downloads close on ${new Date(subscription.access_ends_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.` : ""}</p>
        <p className="sub-banner__links">
          {credits ? <><Link to="/subscription#top-up">Buy credits</Link><Link to="/subscription#plans">Upgrade plan</Link></>
            : storage ? <><Link to="/subscription#storage">Free up space</Link><Link to="/subscription#storage">Request storage</Link></>
            : ended ? <Link to="/subscription#renew">Renew plan</Link>
            : !onPage ? <Link to="/subscription">View subscription</Link> : null}
        </p>
      </div>
    );
  }
  if (summary.data.storage.level === 90) { // Q5: the 90% storage warning, for every member
    return (
      <div className="sub-banner sub-banner--warning" role="status">
        <p>Storage is 90% used. Free up space or request more storage before it is full; at 100% new analyses pause.</p>
        <p className="sub-banner__links"><Link to="/subscription#storage">Manage storage</Link></p>
      </div>
    );
  }
  if (subscription.credits.level === 75 || subscription.credits.level === 90) {
    return (
      <div className="sub-banner sub-banner--warning" role="status">
        <p>{WARN(subscription)}</p>
        <p className="sub-banner__links">{!onPage ? <Link to="/subscription">View subscription</Link> : <a href="#top-up">Buy credits</a>}</p>
      </div>
    );
  }
  return null;
}

/** New analysis: what a run costs, or why it cannot start. */
export function CreditNotice({ engine = "firris" }: { engine?: string }) {
  const status = useCreditStatus(engine);
  if (!status.enforced) return null;
  if (status.blocked && status.message) {
    return <div className="fr-box fr-box--danger sub-credit-notice" role="alert">{status.message} <Link to="/subscription">View subscription</Link></div>;
  }
  if (status.unlimited) return <p className="fr-help sub-credit-notice" role="status">Internal plan: analyses do not use credits.</p>;
  if (status.remaining == null) return null;
  return (
    <p className={`fr-help sub-credit-notice${status.level ? " sub-credit-notice--warning" : ""}`} role="status">
      Running this analysis uses 1 credit. {status.remaining} {status.remaining === 1 ? "credit" : "credits"} remaining this month.
    </p>
  );
}
