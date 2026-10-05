import { useOrganizationContext } from "../organization/OrganizationContext";

export function SettingsPage() {
  const context = useOrganizationContext();
  return <div className="page-stack"><header className="page-heading"><div><span className="eyebrow">Workspace administration</span><h1>Settings</h1><p>Identity and organization context are managed by NOVA's server-side session architecture.</p></div></header><div className="settings-grid"><section className="panel"><h2>Organization</h2><dl className="metadata-grid"><div><dt>Name</dt><dd>{context.current_organization.name}</dd></div><div><dt>Slug</dt><dd>{context.current_organization.slug}</dd></div><div><dt>Your role</dt><dd>{context.current_role}</dd></div><div><dt>Memberships</dt><dd>{context.memberships.length}</dd></div></dl></section><section className="panel"><h2>Security</h2><ul className="check-list"><li>Managed OIDC session</li><li>Server-side provider tokens</li><li>CSRF-protected mutations</li><li>Organization-scoped authorization</li></ul></section></div></div>;
}
