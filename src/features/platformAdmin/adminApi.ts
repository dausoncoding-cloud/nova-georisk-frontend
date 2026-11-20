// NOVA ARI console (/api/v1/platform-admin). The server checks the platform-admin role on every request;
// nothing here decides access.
import { apiClient, unwrapResponse } from "../../shared/api/client";
import type { components } from "../../shared/api/generated/nova-browser-api";

type S = components["schemas"];
export type AdminAccess = S["AdminAccess"];
export type Tiles = S["OverviewTiles"];
export type CustomerRow = S["CustomerRowResponse"];
export type CustomerDetail = S["CustomerDetail"];
export type LoginEntry = S["AdminLoginEntry"];
export type AdminPlan = S["AdminPlan"];
export type AdminPayment = S["AdminPaymentResponse"];
export type SecurityAlert = S["SecurityAlertResponse"];
export type AuditEntry = S["AuditEntry"];
export type AddCustomerBody = S["AddCustomerRequest"];
export type RecordPaymentBody = S["RecordPaymentRequest"];
export type CustomerFilters = { q?: string; status?: string; family?: string; flag?: string; offset?: number };

const withKey = (key: string) => ({ "Idempotency-Key": key });

export const fetchAccess = async () => unwrapResponse(await apiClient.GET("/api/v1/platform-admin/access"));
export const fetchOverview = async () => unwrapResponse(await apiClient.GET("/api/v1/platform-admin/overview"));
export const fetchCustomers = async (query: CustomerFilters) =>
  unwrapResponse(await apiClient.GET("/api/v1/platform-admin/customers", {
    params: { query: { ...query, q: query.q || undefined, status: query.status || undefined, family: query.family || undefined, flag: query.flag || undefined, limit: 50 } },
  }));
export const fetchCustomer = async (organization_id: string) =>
  unwrapResponse(await apiClient.GET("/api/v1/platform-admin/customers/{organization_id}", { params: { path: { organization_id } } }));
export const fetchLoginHistory = async (organization_id: string) =>
  unwrapResponse(await apiClient.GET("/api/v1/platform-admin/customers/{organization_id}/login-history", {
    params: { path: { organization_id }, query: { limit: 10 } },
  }));
export const addCustomer = async (body: AddCustomerBody) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/customers", { body }));
export const changeStatus = async (subscription_id: string, body: S["StatusChangeRequest"]) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/subscriptions/{subscription_id}/status", { params: { path: { subscription_id } }, body }));
export const changePlan = async (subscription_id: string, body: S["PlanChangeRequest"]) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/subscriptions/{subscription_id}/plan", { params: { path: { subscription_id } }, body }));
export const recordPayment = async (subscription_id: string, body: RecordPaymentBody, key: string) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/subscriptions/{subscription_id}/payments", {
    params: { path: { subscription_id }, header: withKey(key) }, body,
  }));
export const addCredits = async (subscription_id: string, body: S["GrantCreditsRequest"], key: string) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/subscriptions/{subscription_id}/credits", {
    params: { path: { subscription_id }, header: withKey(key) }, body,
  }));
export const reversePayment = async (payment_id: string, reason: string, key: string) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/payments/{payment_id}/reverse", {
    params: { path: { payment_id }, header: withKey(key) }, body: { reason },
  }));
export const endSessions = async (organization_id: string, body: S["EndSessionsRequest"]) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/customers/{organization_id}/sessions/end", { params: { path: { organization_id } }, body }));
export const fetchPayments = async (offset: number) =>
  unwrapResponse(await apiClient.GET("/api/v1/platform-admin/payments", { params: { query: { offset, limit: 50 } } }));
export type CustomerRequest = S["AdminRequest"];
export const fetchRequests = async () =>
  unwrapResponse(await apiClient.GET("/api/v1/platform-admin/requests", { params: { query: { state: "open", limit: 50 } } }));
export const closeRequest = async (request_id: string, body: S["CloseRequest"]) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/requests/{request_id}/close", { params: { path: { request_id } }, body }));
export const fetchPlans = async () => unwrapResponse(await apiClient.GET("/api/v1/platform-admin/plans"));
export const changePrice = async (plan_key: string, body: S["PriceChangeRequest"]) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/plans/{plan_key}/prices", { params: { path: { plan_key } }, body }));
export const changeLimits = async (plan_key: string, body: S["LimitChangeRequest"]) =>
  unwrapResponse(await apiClient.PATCH("/api/v1/platform-admin/plans/{plan_key}/limits", { params: { path: { plan_key } }, body }));
export const fetchAlerts = async (state: "open" | "all", offset: number) =>
  unwrapResponse(await apiClient.GET("/api/v1/platform-admin/security-alerts", { params: { query: { state, offset, limit: 50 } } }));
export const acknowledgeAlert = async (alert_id: string, reason: string) =>
  unwrapResponse(await apiClient.POST("/api/v1/platform-admin/security-alerts/{alert_id}/acknowledge", { params: { path: { alert_id } }, body: { reason } }));
export const fetchAudit = async (query: { action?: string; q?: string; offset: number }) =>
  unwrapResponse(await apiClient.GET("/api/v1/platform-admin/audit", {
    params: { query: { action: query.action || undefined, q: query.q || undefined, offset: query.offset, limit: 50 } },
  }));
