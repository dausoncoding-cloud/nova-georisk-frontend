import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../shared/api/queryKeys";
import { fetchEngineContract, fetchEngines } from "./enginesApi";

export function useAvailableEngines() {
  return useQuery({ queryKey: queryKeys.engines, queryFn: fetchEngines, staleTime: 5 * 60_000 });
}

export function useEngineContract(engineKey: string | null) {
  return useQuery({
    queryKey: queryKeys.engineContract(engineKey ?? "unselected"),
    queryFn: () => fetchEngineContract(engineKey as string),
    enabled: Boolean(engineKey),
    staleTime: 5 * 60_000,
  });
}
