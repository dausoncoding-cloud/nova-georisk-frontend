// Subscriptions M5: customers' top-up and upgrade requests on the console's Payments page.
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
    if (path.endsWith("/requests")) return json(request.url, { total: 1, limit: 50, offset: 0, items: [{
      id: "r1", created_at: "2026-11-20T10:00:00Z", organization_id: "o", organization_name: "Rufiji Basin Office", subscription_id: "s",
      family: "frris_wrris", current_plan: "Researcher", kind: "top_up", plan_key: null, plan_name: null, credits: 10, note: null,
      requested_by: "owner@rufiji.example", status: "open", closed_at: null, closed_by: null, close_reason: null }] });
    return json(request.url, { items: [], total: 0, limit: 50, offset: 0 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("lists open requests and closes one only with a reason", async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><PaymentsPage /></MemoryRouter></QueryClientProvider>);
  const section = await screen.findByRole("region", { name: "Requests from customers" });
  expect(section).toHaveTextContent(/Rufiji Basin Office.*Researcher.*Top-up: 10 credits.*owner@rufiji.example/);
  fireEvent.click(within(section).getByRole("button", { name: "Done" }));
  const dialog = await screen.findByRole("dialog", { name: "Mark done · Rufiji Basin Office" });
  const confirm = within(dialog).getByRole("button", { name: "Mark done" });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Paid, MP-77" } });
  fireEvent.click(confirm);
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]).toEqual({ path: "/api/v1/platform-admin/requests/r1/close", body: { outcome: "done", reason: "Paid, MP-77" } });
});
