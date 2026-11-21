// Abliner M3: the Integrations page shows configured yes/no and missing setting names, never a value; Test connection
// shows only a result code.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IntegrationsPage } from "./IntegrationsPage";

const posts: string[] = [];
const json = (url: string, body: unknown, status = 200) => {
  const response = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
};
const base = { enabled: null, last_success_at: null, last_error_at: null, last_error_code: null, last_webhook_at: null,
  last_webhook_event: null, last_test_at: null, last_test_result: null };

beforeEach(() => {
  posts.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method === "POST") { posts.push(path); return json(request.url, { name: "abliner", ok: true, result: "connected" }); }
    return json(request.url, [
      { ...base, name: "abliner", label: "Abliner (Mobile Money)", configured: true, missing: [], enabled: false,
        last_webhook_at: "2026-11-21T08:00:00Z", last_webhook_event: "transaction.completed" },
      { ...base, name: "gee", label: "Google Earth Engine", configured: false, missing: ["GEE_PROJECT_ID"] },
      { ...base, name: "auth0", label: "Auth0 (sign-in)", configured: true, missing: [] },
    ]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("shows status without values and tests a connection", async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><IntegrationsPage /></QueryClientProvider>);
  const abliner = await screen.findByRole("region", { name: "Abliner (Mobile Money)" });
  expect(abliner).toHaveTextContent(/Configured.*Customer payments off/);
  expect(abliner).toHaveTextContent("transaction.completed");
  const gee = screen.getByRole("region", { name: "Google Earth Engine" });
  expect(gee).toHaveTextContent("Missing on the server: GEE_PROJECT_ID");
  expect(within(gee).getByRole("button", { name: "Test connection" })).toBeDisabled();
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(within(abliner).getByRole("button", { name: "Test connection" }));
  await waitFor(() => expect(posts).toEqual(["/api/v1/platform-admin/integrations/abliner/test"]));
  expect(await within(abliner).findByRole("status")).toHaveTextContent("Connected");
});
