// "My subscription" (board 13) and the credit notices. The server enforces every limit; these calls only read
// the organisation's own data, plus "Request top-up" / "Request upgrade" and signing out one's own devices.
import { useQuery } from "@tanstack/react-query";
import { apiClient, assertSuccessfulResponse, unwrapResponse } from "../../shared/api/client";
import type { components } from "../../shared/api/generated/nova-browser-api";

type S = components["schemas"];
export type BillingSummary = S["BillingSummaryResponse"];
export type Subscription = S["SubscriptionSummary"];
export type LedgerEntry = S["LedgerEntryResponse"];
export type PlanOption = S["PlanOption"];
export type Device = S["DeviceSession"];
export type LoginEntry = S["LoginHistoryEntry"];

export const subscriptionKeys = {
  summary: ["billing", "summary"] as const,
  ledger: (family: string) => ["billing", "ledger", family] as const,
  plans: (family: string) => ["billing", "plans", family] as const,
  payments: ["billing", "payments"] as const,
  requests: ["billing", "requests"] as const,
  devices: ["account", "sessions"] as const,
  logins: ["account", "login-history"] as const,
};

export const fetchSummary = async () => unwrapResponse(await apiClient.GET("/api/v1/billing/summary"));
export const fetchLedger = async (family: string) =>
  unwrapResponse(await apiClient.GET("/api/v1/billing/ledger", { params: { query: { family, limit: 20 } } }));
export const fetchPlans = async (family: "frris_wrris" | "megis") =>
  unwrapResponse(await apiClient.GET("/api/v1/billing/plans", { params: { query: { family } } }));
export const fetchPayments = async () => unwrapResponse(await apiClient.GET("/api/v1/billing/payments", { params: { query: { limit: 20 } } }));
export const fetchRequests = async () => unwrapResponse(await apiClient.GET("/api/v1/billing/requests"));
export const sendRequest = async (body: S["SubscriptionRequestCreate"]) =>
  unwrapResponse(await apiClient.POST("/api/v1/billing/requests", { body }));
export const fetchDevices = async () => unwrapResponse(await apiClient.GET("/api/v1/account/sessions"));
export const fetchLogins = async () => unwrapResponse(await apiClient.GET("/api/v1/account/login-history", { params: { query: { limit: 10 } } }));
export const signOutDevice = async (session_id: string) =>
  assertSuccessfulResponse(await apiClient.POST("/api/v1/account/sessions/{session_id}/sign-out", { params: { path: { session_id } } }));

export function useBillingSummary() {
  return useQuery({ queryKey: subscriptionKeys.summary, queryFn: fetchSummary, staleTime: 60_000, retry: false });
}

/** The subscription that covers an engine (FRRIS is "firris"). */
export function subscriptionFor(summary: BillingSummary | undefined, engine: string): Subscription | undefined {
  // Defensive: the banner sits in the app layout and must never break a page.
  return Array.isArray(summary?.subscriptions) ? summary.subscriptions.find((item) => item.engines?.includes(engine)) : undefined;
}

export type CreditStatus = { enforced: boolean; blocked: boolean; message: string | null; remaining: number | null; unlimited: boolean; level: number | null };

/** What the New analysis page needs: may this organisation start a run, and how many credits are left. */
export function useCreditStatus(engine: string): CreditStatus {
  const summary = useBillingSummary();
  const subscription = subscriptionFor(summary.data, engine);
  const enforced = summary.data?.enforcement_enabled ?? false;
  if (!enforced) return { enforced, blocked: false, message: null, remaining: null, unlimited: false, level: null };
  if (!subscription) {
    // The server answers 402 "subscription_required"; say so before the user fills the form.
    return { enforced, blocked: summary.isSuccess, message: summary.isSuccess ? "This organisation has no subscription for this system. Contact NOVA ARI." : null, remaining: null, unlimited: false, level: null };
  }
  return {
    enforced, blocked: !subscription.can_submit, message: subscription.block_message ?? null,
    remaining: subscription.credits.remaining, unlimited: subscription.credits.unlimited ?? false, level: subscription.credits.level ?? null,
  };
}

export const FAMILY_NAME: Record<string, string> = { frris_wrris: "FRRIS and WRRIS", megis: "MEGIS" };
export const SYSTEM_NAME: Record<string, string> = { frris_wrris: "FRRIS", megis: "MEGIS" };
