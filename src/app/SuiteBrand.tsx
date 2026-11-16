import { Link } from "react-router-dom";
import { Icon } from "../shared/ui/Icon";

export function SuiteBrand({ linked = false, compact = false }: { linked?: boolean; compact?: boolean }) {
  const content = <>
    <span className="fr-brand__mark" aria-hidden="true"><Icon name="globe" width={18} height={18} strokeWidth={2} /></span>
    <span className="fr-brand__copy"><strong>NOVA-GeoRisk</strong>{compact ? null : <span>by NOVAREX</span>}</span>
  </>;
  return linked
    ? <Link className="fr-brand fr-brand--link" to="/" aria-label="NOVA-GeoRisk, all systems">{content}</Link>
    : <div className="fr-brand">{content}</div>;
}

export function roleLabel(role: string): string {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
}
