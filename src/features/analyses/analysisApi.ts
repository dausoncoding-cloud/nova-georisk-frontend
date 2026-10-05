import type { components } from "../../shared/api/generated/nova-browser-api";
import { apiClient, unwrapResponse } from "../../shared/api/client";

export type AnalysisSubmitRequest = components["schemas"]["AnalysisSubmitRequest"];
export type FirrisProduct = components["schemas"]["FIRRISProduct"];

export async function submitAnalysis(body: AnalysisSubmitRequest) {
  return unwrapResponse(await apiClient.POST("/api/v1/analyses", { body }));
}
