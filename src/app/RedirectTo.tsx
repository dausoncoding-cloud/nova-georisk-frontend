import { Navigate, useLocation } from "react-router-dom";

// Redirect for a route that moved: keeps the query string and hash so old links and bookmarks
// (for example /tasks?status=failed) land on the same view at the new address.
export function RedirectTo({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}
