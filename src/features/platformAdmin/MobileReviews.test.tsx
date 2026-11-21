// Abliner M2: Mobile Money payments in review appear on the console's Payments page with a badge; closing one
// needs a reason and never adds credits by itself.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PaymentsPage } from "./ConsolePages";

const posts: { path: string; body: unknown }[] = [];
const json = (url: string, body: unknown, status = 200) => {
  const response = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
};

beforeEach(() => {
  posts.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method === "POST") { posts.push({ path, body: await request.clone().json() }); return json(request.url, {}); }
    if (path.endsWith("/mobile-payments")) return json(request.url, { total: 1, limit: 50, offset: 0, items: [{
      id: "i1", created_at: "2026-11-21T08:00:00Z", organization_id: "o", organization_name: "Rufiji Basin Office",
      subscription_id: "s", purpose: "top_up", amount: 100000, currency: "TZS", credits: 10, phone: "2557•••••678",
      status: "review", reference: "NOVA-ABCD1234", abliner_tx_id: "tx_1", abliner_event_tx_id: "uuid-1",
      provider_reference: "PRV-1", failure_code: null, review_reason: "Abliner completed payment does not match: amount 1000 instead of 100000.",
      payment_id: null, resolution: null, resolved_at: null }] });
    return json(request.url, { items: [], total: 0, limit: 50, offset: 0 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("shows payments in review with a badge and closes one only with a reason", async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><PaymentsPage /></MemoryRouter></QueryClientProvider>);
  const section = await screen.findByRole("region", { name: /Mobile Money payments to review/ });
  expect(section).toHaveTextContent(/Rufiji Basin Office.*Review.*TZS 100,000.*Top-up · 10 credits.*amount 1000 instead of 100000.*uuid-1/);
  expect(section).toHaveTextContent("2557•••••678");
  fireEvent.click(within(section).getByRole("button", { name: "No action" }));
  const dialog = await screen.findByRole("dialog", { name: "No action · Rufiji Basin Office" });
  const confirm = within(dialog).getByRole("button", { name: "Close without credit" });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Test amount, confirmed by phone" } });
  fireEvent.click(confirm);
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]).toEqual({ path: "/api/v1/platform-admin/mobile-payments/i1/resolve", body: { resolution: "no_action", reason: "Test amount, confirmed by phone" } });
});
