import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingState } from "../../shared/ui/LoadingState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { useSession } from "./authQueries";

export function RequireSession() {
  const location = useLocation();
  const session = useSession();

  if (session.isPending) return <LoadingState label="Checking your NOVA session…" />;
  if (session.isError) {
    return (
      <ErrorState
        title="We could not verify your session"
        error={session.error}
        onRetry={() => void session.refetch()}
      />
    );
  }
  if (!session.data.authenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ returnTo }} />;
  }

  return <Outlet />;
}
