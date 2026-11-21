// Abliner M3: NOVA ARI Integrations. Read-only: whether each outside service is configured (names of missing
// settings, never values), its last success, error and webhook, and an audited "Test connection" (a result code).
// Keys and secrets are set on the server by the owner over SSH; nothing here can change them.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "../../shared/api/errors";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchIntegrations, testIntegration, type Integration } from "./adminApi";
import { dateTime } from "./format";

const RESULT: Record<string, string> = {
  connected: "Connected", reachable: "Reachable", not_configured: "Not configured", timeout: "Timed out",
  unauthorized: "Key refused", unreachable: "Unreachable", initialize_failed: "Sign-in failed",
};
const label = (code: string | null | undefined) => (code ? RESULT[code] ?? code.replace(/_/g, " ") : "—");

export function IntegrationsPage() {
  const list = useQuery({ queryKey: ["platform-admin", "integrations"], queryFn: fetchIntegrations });
  return (
    <div className="ari-page">
      <header className="ari-page__header"><div><h1>Integrations</h1>
        <p>Outside services NOVA-GeoRisk depends on. Read-only: keys and secrets are set on the server and are never shown here.</p></div></header>
      {list.isPending ? <LoadingState label="Loading integrations…" /> : list.isError ? <ErrorState title="Integrations unavailable" error={list.error} /> : (
        <div className="ari-grid">{list.data.map((item) => <IntegrationCard key={item.name} item={item} />)}</div>
      )}
    </div>
  );
}

function IntegrationCard({ item }: { item: Integration }) {
  const cache = useQueryClient();
  const test = useMutation({
    mutationFn: () => testIntegration(item.name),
    onSettled: () => void cache.invalidateQueries({ queryKey: ["platform-admin", "integrations"] }),
  });
  const headingId = `integration-${item.name}`;
  return (
    <section className="ari-card" aria-labelledby={headingId}>
      <div className="ari-card__head">
        <h2 id={headingId}>{item.label}</h2>
        <span className={`ari-pill ari-pill--${item.configured ? "success" : "warning"}`}>{item.configured ? "Configured" : "Not configured"}</span>
        {item.enabled != null ? <span className={`ari-pill ari-pill--${item.enabled ? "info" : "neutral"}`}>{item.enabled ? "Customer payments on" : "Customer payments off"}</span> : null}
      </div>
      {item.missing.length ? <p className="ari-sub">Missing on the server: {item.missing.join(", ")}</p> : null}
      <dl className="ari-facts">
        <div><dt>Last success</dt><dd>{item.last_success_at ? dateTime(item.last_success_at) : "—"}</dd></div>
        <div><dt>Last error</dt><dd>{item.last_error_at ? `${dateTime(item.last_error_at)} · ${label(item.last_error_code)}` : "—"}</dd></div>
        {item.name === "abliner" ? <div><dt>Last webhook</dt><dd>{item.last_webhook_at ? `${dateTime(item.last_webhook_at)} · ${item.last_webhook_event ?? ""}` : "—"}</dd></div> : null}
        <div><dt>Last test</dt><dd>{item.last_test_at ? `${dateTime(item.last_test_at)} · ${label(item.last_test_result)}` : "—"}</dd></div>
      </dl>
      <div>
        <button type="button" className="fr-button fr-button--secondary" disabled={test.isPending || !item.configured} onClick={() => test.mutate()}>
          {test.isPending ? "Testing…" : "Test connection"}
        </button>
        {test.data ? <p className={test.data.ok ? "ari-sub" : "inline-alert"} role="status">{label(test.data.result)}</p> : null}
        {test.isError ? <p className="inline-alert" role="alert">{getErrorMessage(test.error)}</p> : null}
        <p className="ari-sub">Each test is recorded in the audit log. At most one test per 30 seconds.</p>
      </div>
    </section>
  );
}
