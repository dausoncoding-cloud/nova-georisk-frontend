import { createContext, type PropsWithChildren, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchOrganizationContext } from "./organizationApi";

type OrganizationContextResponse = components["schemas"]["OrganizationContextResponse"];

const OrganizationContext = createContext<OrganizationContextResponse | null>(null);

export function OrganizationContextProvider({ children }: PropsWithChildren) {
  const query = useQuery({
    queryKey: queryKeys.organization,
    queryFn: fetchOrganizationContext,
    staleTime: 30_000,
  });

  if (query.isPending) return <LoadingState label="Loading organization workspace…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Organization access is unavailable"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return <OrganizationContext.Provider value={query.data}>{children}</OrganizationContext.Provider>;
}

export function useOrganizationContext(): OrganizationContextResponse {
  const value = useContext(OrganizationContext);
  if (!value) throw new Error("useOrganizationContext must be used inside OrganizationContextProvider.");
  return value;
}
