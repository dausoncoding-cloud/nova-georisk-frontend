import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearSessionExpired } from "./sessionExpiry";
import { buildLoginUrl, sanitizeReturnTo } from "./authNavigation";
import { useAuthConfig, useSession } from "./authQueries";
import { getErrorMessage } from "../../shared/api/errors";
import { LoadingState } from "../../shared/ui/LoadingState";
import { SessionEndedState } from "../../shared/ui/StatusStates";
import { SuiteBrand } from "../../app/SuiteBrand";

type LoginLocationState = { returnTo?: string; expired?: boolean } | null;

export function LoginPage() {
  const location = useLocation();
  const session = useSession();
  const authConfig = useAuthConfig();
  const state = location.state as LoginLocationState;
  const queryReturnTo = new URLSearchParams(location.search).get("return_to");
  const returnTo = sanitizeReturnTo(state?.returnTo ?? queryReturnTo);
  useEffect(() => clearSessionExpired(), []);

  if (session.isPending) return <LoadingState label="Checking your NOVA session…" />;
  if (session.data?.authenticated) return <Navigate to={returnTo} replace />;

  const isConfigured = authConfig.data?.configured ?? false;
  const canSignIn = authConfig.isSuccess && isConfigured;
  const authError = authConfig.isError ? getErrorMessage(authConfig.error) : session.isError ? getErrorMessage(session.error) : null;

  if (state?.expired) {
    // P5: the session ended while the user was working; signing in again returns to the same page.
    return (
      <div className="fr-suite">
        <header className="fr-suite__header"><SuiteBrand /></header>
        <main id="main-content" className="fr-suite__main fr-state-page">
          <SessionEndedState disabled={!canSignIn} onSignIn={() => window.location.assign(buildLoginUrl(returnTo))}>
            {authError ? <p className="fr-box fr-box--danger" role="alert">{authError}</p> : null}
            {authConfig.isSuccess && !isConfigured ? <p className="fr-box fr-box--danger" role="alert">{authConfig.data.message}</p> : null}
          </SessionEndedState>
        </main>
      </div>
    );
  }

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="NOVA GeoRisk">
        <div className="brand-mark" aria-hidden="true">N</div>
        <div>
          <p className="eyebrow eyebrow--light">NOVA GeoRisk</p>
          <h1>Risk intelligence, grounded in place.</h1>
          <p className="login-intro">
            One secure workspace for organizations to manage projects and monitor analysis results.
          </p>
        </div>
        <div className="contour-lines" aria-hidden="true" />
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">Secure workspace</span>
          <h2>Sign in to NOVA</h2>
          <p>Continue through your organization's managed identity provider.</p>

          {authConfig.isPending ? <p className="status-note">Checking sign-in availability…</p> : null}
          {authError ? <div className="inline-alert" role="alert">{authError}</div> : null}
          {authConfig.isSuccess && !isConfigured ? (
            <div className="inline-alert" role="alert">{authConfig.data.message}</div>
          ) : null}

          <button
            className="button button--primary button--wide"
            type="button"
            disabled={!canSignIn}
            onClick={() => window.location.assign(buildLoginUrl(returnTo))}
          >
            Continue with SSO
          </button>

          <p className="security-note">
            Authentication is completed by the NOVA server. Provider credentials and tokens are never stored in this browser application.
          </p>
        </div>
      </section>
    </main>
  );
}
