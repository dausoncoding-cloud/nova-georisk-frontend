// UI refresh P5: access denied (403), not found (404) and session ended, end to end where possible.
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../shared/api/errors";
import { ErrorState } from "../shared/ui/ErrorState";
import { AppProviders } from "./AppProviders";
import { AppRouter } from "./AppRouter";
import { NotFoundPage } from "./NotFoundPage";

const org = { id: "11111111-1111-4111-8111-111111111111", name: "Org One", slug: "org-one" };
let currentUrl = "http://localhost/";
// Browsers set Response.url; the client middleware reads it to recognise 401s from the API.
const json = (body: unknown, status = 200) => {
  const response = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: currentUrl });
  return response;
};

describe("403 and 404 from the API", () => {
  const renderError = (error: unknown, subject?: "analysis") => render(<MemoryRouter><ErrorState title="Result could not be loaded" error={error} subject={subject} /></MemoryRouter>);

  it("shows the access-denied state for 403, with the request reference and a way back", () => {
    renderError(new ApiError({ message: "Forbidden", status: 403, code: "forbidden", requestId: "req-42" }), "analysis");
    const state = screen.getByRole("region", { name: "You don't have access to this" });
    expect(within(state).getByRole("heading", { level: 1, name: "You don't have access to this" })).toBeInTheDocument();
    expect(state).toHaveTextContent("403");
    expect(state).toHaveTextContent("This analysis belongs to another organization, or your role does not allow this action.");
    expect(state).toHaveTextContent("Reference: req-42");
    expect(within(state).getByRole("link", { name: "Back to analyses" })).toHaveAttribute("href", "/frris/analyses");
    expect(screen.queryByText("Result could not be loaded")).toBeNull();
  });

  it("shows the not-found state for 404", () => {
    renderError(new ApiError({ message: "Not found", status: 404, code: "not_found" }), "analysis");
    const state = screen.getByRole("region", { name: "Page not found" });
    expect(state).toHaveTextContent("The link may be old, or the analysis was removed.");
    expect(within(state).getByRole("link", { name: "Go to your systems" })).toHaveAttribute("href", "/");
  });

  it("keeps the retry card for other errors", () => {
    render(<MemoryRouter><ErrorState title="Result could not be loaded" error={new ApiError({ message: "Upstream unavailable", status: 503, code: "unavailable" })} onRetry={() => undefined} /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("Upstream unavailable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("unknown addresses get the 404 page", () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("The link may be old, or the page was removed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your systems" })).toHaveAttribute("href", "/");
  });
});

describe("session ended (end to end through the API client)", () => {
  let signedIn = true;
  let unauthorizedCalls = 0;
  beforeEach(() => {
    signedIn = true;
    unauthorizedCalls = 0;
    window.history.pushState({}, "", "/frris/analyses?status=running");
    vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
      currentUrl = request.url;
      const path = new URL(request.url).pathname;
      if (path === "/auth/session") return json(signedIn
        ? { authenticated: true, csrfToken: "t", organization: { id: org.id, name: org.name }, roles: ["analyst"], user: { id: "u", displayName: "Session User", email: "user@example.test" } }
        : { authenticated: false, csrfToken: null, organization: null, roles: [], user: null });
      if (path === "/api/v1/projects") return json([]);
      if (path === "/api/v1/engines") return json([{ key: "firris", access: true }]);
      if (path === "/auth/config") return json({ configured: true, message: "" });
      if (path === "/api/v1/organizations/current") return json({ user: { id: "u", display_name: "Session User", email: null }, current_organization: org, current_role: "analyst", memberships: [{ organization: org, role: "analyst", created_at: "2026-01-01T00:00:00Z" }] });
      // The session ends on the server: the next API call is refused, and the session check now says signed out.
      if (path === "/api/v1/tasks") { signedIn = false; unauthorizedCalls += 1; return json({ error: { code: "unauthorized", message: "Session expired" } }, 401); }
      return json({ items: [], total: 0, limit: 50, offset: 0 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("explains that the session ended and signs in again to the same page", async () => {
    render(<AppProviders><AppRouter /></AppProviders>);
    const state = await screen.findByRole("region", { name: "Your session has ended" }, { timeout: 4000 });
    expect(unauthorizedCalls).toBeGreaterThan(0);
    expect(within(state).getByRole("heading", { level: 1, name: "Your session has ended" })).toBeInTheDocument();
    expect(state).toHaveTextContent("Running analyses are not affected.");
    await waitFor(() => expect(within(state).getByRole("button", { name: "Sign in again" })).toBeEnabled());
    expect(window.location.pathname).toBe("/login");
    expect(window.history.state?.usr).toMatchObject({ returnTo: "/frris/analyses?status=running", expired: true });
  });

  it("a first visit without a session shows the normal sign-in, not the session-ended screen", async () => {
    signedIn = false;
    window.history.pushState({}, "", "/frris/analyses");
    render(<AppProviders><AppRouter /></AppProviders>);
    expect(await screen.findByRole("button", { name: "Continue with SSO" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your session has ended" })).toBeNull();
  });
});
