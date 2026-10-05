import { useLocation } from "react-router-dom";
import { buildLoginUrl } from "../auth/authNavigation";
import { useOrganizationContext } from "./OrganizationContext";

export function OrganizationMenu() {
  const location = useLocation();
  const context = useOrganizationContext();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  return (
    <label className="organization-picker">
      <span>Organization</span>
      <select
        value={context.current_organization.id}
        onChange={(event) => {
          const organizationId = event.target.value;
          if (organizationId !== context.current_organization.id) {
            window.location.assign(buildLoginUrl(returnTo, organizationId));
          }
        }}
      >
        {context.memberships.map((membership) => (
          <option key={membership.organization.id} value={membership.organization.id}>
            {membership.organization.name} · {membership.role}
          </option>
        ))}
      </select>
    </label>
  );
}
