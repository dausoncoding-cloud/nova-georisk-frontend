import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../shared/api/queryKeys";
import { fetchAuthConfig, fetchSession } from "./authApi";

export function useAuthConfig() {
  return useQuery({
    queryKey: queryKeys.authConfig,
    queryFn: fetchAuthConfig,
    staleTime: 5 * 60_000,
  });
}

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
