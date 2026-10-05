import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/nova-browser-api";
import { getCsrfToken } from "./csrf";
import { toApiError } from "./errors";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const unauthorizedListeners = new Set<() => void>();

const securityMiddleware: Middleware = {
  onRequest({ request }) {
    if (unsafeMethods.has(request.method.toUpperCase())) {
      const token = getCsrfToken();
      if (token) {
        request.headers.set("X-CSRF-Token", token);
      }
    }
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401 && !new URL(response.url).pathname.endsWith("/auth/session")) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    return response;
  },
};

export const apiClient = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: "include",
  fetch: (request) => globalThis.fetch(request),
  headers: { Accept: "application/json" },
});

apiClient.use(securityMiddleware);

export function subscribeToUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function unwrapResponse<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response, result.error);
  }
  if (result.data === undefined) {
    throw toApiError(result.response, undefined);
  }
  return result.data;
}

export function assertSuccessfulResponse(result: {
  error?: unknown;
  response: Response;
}): void {
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response, result.error);
  }
}
