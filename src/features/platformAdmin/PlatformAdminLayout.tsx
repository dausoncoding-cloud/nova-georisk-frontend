import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { ApiError } from "../../shared/api/errors";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { LogoutButton } from "../auth/LogoutButton";
import { fetchAccess } from "./adminApi";
import "./platform-admin.css";

export const ARI_NAV = [
  { to: "/nova-ari", label: "Customers", end: true },
  { to: "/nova-ari/payments", label: "Payments" },
  { to: "/nova-ari/plans", label: "Plans and pricing" },
  { to: "/nova-ari/security-alerts", label: "Security alerts" },
  { to: "/nova-ari/integrations", label: "Integrations" },
  { to: "/nova-ari/audit", label: "Audit log" },
] as const;

export const accessQuery = { queryKey: ["platform-admin", "access"], queryFn: fetchAccess, retry: false, staleTime: 60_000 } as const;

// Board 14: NOVA ARI Administration. The page is only a view: the API refuses every request from
// someone who is not a NOVA ARI admin.
export function PlatformAdminLayout() {
  const access = useQuery(accessQuery);
  if (access.isPending) return <LoadingState label="Checking NOVA ARI access…" />;
  if (access.isError) {
    const forbidden = access.error instanceof ApiError && access.error.status === 403;
    return (
      <main className="ari-denied" id="main-content">
        {forbidden
          ? <section className="panel content-panel" role="alert"><h1>NOVA ARI administration</h1><p>This area is for NOVA ARI platform administrators.</p></section>
          : <ErrorState title="Administration unavailable" error={access.error} onRetry={() => void access.refetch()} />}
      </main>
    );
  }
  return (
    <div className="ari-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="ari-sidebar" aria-label="NOVA ARI administration">
        <div className="ari-brand">
          <span className="ari-brand__mark" aria-hidden="true">◎</span>
          <span><strong>NOVA ARI</strong><span>Administration</span></span>
        </div>
        <nav aria-label="Administration">
          <ul>
            {ARI_NAV.map((item) => (
              <li key={item.to}><NavLink to={item.to} end={"end" in item ? item.end : false}>{item.label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="ari-sidebar__account">
          <strong>{access.data.display_name}</strong>
          <span>{access.data.organization_name ? `${access.data.organization_name} · ` : ""}Platform admin</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="ari-main" id="main-content" tabIndex={-1}><Outlet /></main>
    </div>
  );
}
