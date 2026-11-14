import type { components } from "../../shared/api/generated/nova-browser-api";
import { apiClient, unwrapResponse } from "../../shared/api/client";

export type AnalysisSubmitRequest = components["schemas"]["AnalysisSubmitRequest"];
export type FirrisProduct = components["schemas"]["FIRRISProduct"];

export async function submitAnalysis(body: AnalysisSubmitRequest) {
  return unwrapResponse(await apiClient.POST("/api/v1/analyses", { body }));
}

export type AnalysisPreflightResponse = components["schemas"]["AnalysisPreflightResponse"];
export type AnalysisPreflightPeriod = components["schemas"]["AnalysisPreflightPeriod"];

// Plan 4.1: metadata-only availability check. Never creates a task.
export async function preflightAnalysis(body: AnalysisSubmitRequest) {
  return unwrapResponse(await apiClient.POST("/api/v1/analyses/preflight", { body }));
}
