import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";

// Full-page states from the design (11 · Empty & error states): access denied, not found, session ended.
function StateCard({ tone, icon, code, title, children, actions, label }: {
  tone: "neutral" | "warning"; icon: Parameters<typeof Icon>[0]["name"]; code?: string; title: string; children: ReactNode; actions: ReactNode; label: string;
}) {
  return (
    <section className="fr-state" aria-labelledby="fr-state-title" data-state={label}>
      <span className={`fr-state__icon fr-state__icon--${tone}`} aria-hidden="true"><Icon name={icon} width={28} height={28} strokeWidth={2} /></span>
      {code ? <span className="fr-state__code fr-num">{code}</span> : null}
      <h1 id="fr-state-title">{title}</h1>
      {children}
      <div className="fr-state__actions">{actions}</div>
    </section>
  );
}

export function AccessDeniedState({ subject = "item", reference }: { subject?: "analysis" | "item"; reference?: string | null }) {
  return (
    <StateCard tone="neutral" icon="shield" code="403" title="You don't have access to this" label="Access denied"
      actions={<Link className="fr-button fr-button--secondary" to="/frris/analyses">Back to analyses</Link>}>
      <p>{subject === "analysis" ? "This analysis belongs to another organization" : "This belongs to another organization"}, or your role does not allow this action. Ask your organization administrator if you need access.</p>
      {reference ? <p className="fr-state__ref">Reference: <span className="fr-num">{reference}</span></p> : null}
    </StateCard>
  );
}

export function NotFoundState({ subject = "item", reference }: { subject?: "analysis" | "item" | "page"; reference?: string | null }) {
  return (
    <StateCard tone="neutral" icon="search" code="404" title="Page not found" label="Page not found"
      actions={<Link className="fr-button fr-button--secondary" to="/">Go to your systems</Link>}>
      <p>{subject === "analysis" ? "The link may be old, or the analysis was removed." : "The link may be old, or the page was removed."}</p>
      {reference ? <p className="fr-state__ref">Reference: <span className="fr-num">{reference}</span></p> : null}
    </StateCard>
  );
}

export function SessionEndedState({ onSignIn, disabled, children }: { onSignIn: () => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <StateCard tone="warning" icon="tasks" title="Your session has ended" label="Session ended"
      actions={<button type="button" className="fr-button fr-button--primary" disabled={disabled} onClick={onSignIn}>Sign in again</button>}>
      <p>For security your session has ended, so you need to sign in again. You return to the page you were on. Running analyses are not affected.</p>
      {children}
    </StateCard>
  );
}
