import { apiClient, assertSuccessfulResponse, unwrapResponse } from "../../shared/api/client";
import { clearCsrfToken, setCsrfToken } from "../../shared/api/csrf";

export async function fetchAuthConfig() {
  return unwrapResponse(await apiClient.GET("/auth/config"));
}

export async function fetchSession() {
  const session = unwrapResponse(await apiClient.GET("/auth/session"));
  setCsrfToken(session.authenticated ? session.csrfToken : null);
  return session;
}

export async function logout(): Promise<void> {
  const result = await apiClient.POST("/auth/logout");
  assertSuccessfulResponse(result);
  clearCsrfToken();
}
