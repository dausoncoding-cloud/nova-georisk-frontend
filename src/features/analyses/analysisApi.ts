import type { components } from "../../shared/api/generated/nova-browser-api";
import { apiClient, unwrapResponse } from "../../shared/api/client";

export type AnalysisSubmitRequest = components["schemas"]["AnalysisSubmitRequest"];
export type FirrisProduct = components["schemas"]["FIRRISProduct"];

// The Idempotency-Key makes a resent request return the first task instead of a second task and charge.
export async function submitAnalysis(body: AnalysisSubmitRequest, idempotencyKey?: string) {
  return unwrapResponse(await apiClient.POST("/api/v1/analyses", {
    body, params: idempotencyKey ? { header: { "Idempotency-Key": idempotencyKey } } : {},
  }));
}

export type AnalysisPreflightResponse = components["schemas"]["AnalysisPreflightResponse"];
export type AnalysisPreflightPeriod = components["schemas"]["AnalysisPreflightPeriod"];

// Plan 4.1: metadata-only availability check. Never creates a task.
export async function preflightAnalysis(body: AnalysisSubmitRequest) {
  return unwrapResponse(await apiClient.POST("/api/v1/analyses/preflight", { body }));
}
