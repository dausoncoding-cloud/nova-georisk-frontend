import { apiClient, unwrapResponse } from "../../shared/api/client";

export async function fetchEngines() {
  return unwrapResponse(await apiClient.GET("/api/v1/engines"));
}

export async function fetchEngineContract(engineKey: string) {
  return unwrapResponse(
    await apiClient.GET("/api/v1/analyses/engines/{engine_key}", {
      params: { path: { engine_key: engineKey } },
    }),
  );
}
