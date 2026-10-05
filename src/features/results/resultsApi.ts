import { apiClient, unwrapResponse } from "../../shared/api/client";

export type ResultFilters = {
  project_id?: string;
  aoi_id?: string;
  task_id?: string;
  result_type?: string;
  engine_key?: string;
  limit?: number;
  offset?: number;
};

export async function fetchResults(filters: ResultFilters = {}) {
  return unwrapResponse(await apiClient.GET("/api/v1/results", { params: { query: filters } }));
}

export async function fetchResult(resultId: string) {
  return unwrapResponse(
    await apiClient.GET("/api/v1/results/{result_id}", {
      params: { path: { result_id: resultId } },
    }),
  );
}

export function protectedProductUrl(resultId: string, productKey: string): string {
  return `/api/v1/results/${encodeURIComponent(resultId)}/products/${encodeURIComponent(productKey)}`;
}
