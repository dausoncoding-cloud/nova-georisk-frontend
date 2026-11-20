// Subscriptions M3: a session ended elsewhere (plan session limit, another device, NOVA ARI) says why on the sign-in page.
// Own file: AppProviders keeps one module-level query cache, so the session answer must not leak from other tests.
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import { AppRouter } from "../../app/AppRouter";

const NOTICE = "You were signed out because your account signed in on another device (Chrome on Windows, Dar es Salaam, 14:02).";
const json = (url: string, body: unknown, status = 200) => {
  const response = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
};

describe("signed out on another device", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/frris/analyses");
    vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/auth/session") {
        return json(request.url, { authenticated: false, csrfToken: null, organization: null, roles: [], user: null, signedOutNotice: NOTICE });
      }
      if (path === "/auth/config") return json(request.url, { configured: true, message: "" });
      return json(request.url, { error: { code: "session_ended", message: NOTICE } }, 401);
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the session-ended screen with the reason", async () => {
    render(<AppProviders><AppRouter /></AppProviders>);
    const state = await screen.findByRole("region", { name: "Your session has ended" }, { timeout: 4000 });
    expect(within(state).getByRole("status")).toHaveTextContent(NOTICE);
    expect(within(state).getByRole("button", { name: "Sign in again" })).toBeInTheDocument();
  }, 10000);
});
