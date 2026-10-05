import { useOrganizationContext } from "./OrganizationContext";

export function OrganizationSummaryCard() {
  const context = useOrganizationContext();

  return (
    <section className="context-card" aria-labelledby="workspace-heading">
      <div>
        <span className="eyebrow">Current workspace</span>
        <h2 id="workspace-heading">{context.current_organization.name}</h2>
        <p>@{context.current_organization.slug}</p>
      </div>
      <dl className="context-facts">
        <div>
          <dt>Your role</dt>
          <dd><span className="role-badge">{context.current_role}</span></dd>
        </div>
        <div>
          <dt>Memberships</dt>
          <dd>{context.memberships.length}</dd>
        </div>
      </dl>
    </section>
  );
}
