import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { clearCsrfToken, setCsrfToken } from "./csrf";

describe("browser API client security policy", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it("sends the in-memory CSRF token and opaque session cookie policy on unsafe requests", async () => {
    setCsrfToken("csrf-value");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await apiClient.POST("/auth/logout");

    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).headers.get("X-CSRF-Token")).toBe("csrf-value");
    expect((request as Request).credentials).toBe("include");
    expect((request as Request).headers.has("Authorization")).toBe(false);
    expect((request as Request).headers.has("X-Internal-Secret")).toBe(false);
  });
});
