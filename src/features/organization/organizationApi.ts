import { apiClient, unwrapResponse } from "../../shared/api/client";

export async function fetchOrganizationContext() {
  return unwrapResponse(await apiClient.GET("/api/v1/organizations/current"));
}
