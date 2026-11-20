import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { accessQuery } from "./PlatformAdminLayout";

// Shown only to NOVA ARI admins (the access check returns 403 to everyone else; nothing is shown then).
export function AdminConsoleLink() {
  const access = useQuery(accessQuery);
  return access.isSuccess ? <Link className="fr-button fr-button--secondary" to="/nova-ari">NOVA ARI administration</Link> : null;
}
