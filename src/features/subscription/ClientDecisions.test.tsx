// Client decisions (2026-11-21) on My subscription: Q5 storage (90% / 100%, free up space, request storage),
// Q6 receipts and seller identity, Q7 expiry (grace and renew), Q9 privacy notice (also on the sign-in page).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LoginPage } from "../auth/LoginPage";
import { SubscriptionBanner } from "./SubscriptionNotices";
import { PRIVACY_NOTICE, SubscriptionPage } from "./SubscriptionPage";

vi.mock("../organization/OrganizationContext", () => ({
  useOrganizationContext: () => ({ current_role: "owner", current_organization: { id: "o", name: "Rufiji Basin" }, user: { id: "u" }, memberships: [] }),
}));

const SUB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let state = { status: "active", storageLevel: null as number | null, blockCode: null as string | null };
let posts: { path: string; body: unknown }[] = [];
const json = (url: string, body: unknown, status = 200) => {
  const response = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
};
const subscription = () => ({
  id: SUB, family: "frris_wrris", plan_key: "frris_wrris.researcher", plan_name: "Researcher", is_internal: false, status: state.status,
  status_label: state.status, starts_at: null, ends_at: null, engines: ["firris"], currency: "TZS", monthly_price: 150000,
  limits: { seat_limit: 1, monthly_credits: 10, storage_bytes: 2e9, session_limit: 1 }, seats_used: 1, renews_on: null,
  warning_levels: [75, 90], top_up: { credits: 10, price: 150000, currency: "TZS" },
  credits: { period: "2026-11", granted: 10, top_ups: 0, used: 1, remaining: 9, available: 10, used_percent: 10, level: null, unlimited: false },
  can_submit: !state.blockCode, block_code: state.blockCode,
  block_message: state.blockCode === "subscription_expired" ? "This subscription has expired." : state.blockCode ? "Storage is full." : null,
  access_ends_at: state.status === "expired" ? "2026-11-23T10:00:00Z" : null,
});

beforeEach(() => {
  state = { status: "active", storageLevel: null, blockCode: null };
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method === "POST") { posts.push({ path, body: await request.clone().json().catch(() => null) });
      return json(request.url, path.endsWith("delete-files") ? { result_id: "r1", files_deleted: 2, bytes_freed: 1.8e9, storage: { used: 2e8, limit: 2e9, level: null } }
        : { id: "q1", subscription_id: SUB, kind: "storage", plan_key: null, plan_name: null, credits: null, storage_gb: 5, storage_price: null, status: "open", created_at: "2026-11-21T10:00:00Z", closed_at: null, existing: false }, path.endsWith("delete-files") ? 200 : 201); }
    if (path === "/api/v1/billing/summary") return json(request.url, { enforcement_enabled: true, subscriptions: [subscription()], seats: { used: 1, limit: 1, level: 100 },
      storage: { used: state.storageLevel === 100 ? 2e9 : 1.85e9, limit: 2e9, level: state.storageLevel }, storage_blocks_at_limit: true,
      seller: { legal_name: "Seller Placeholder Ltd", tin: "100-000-000", address: null, vat_mode: "none", vat_rate_percent: 18 } });
    if (path === "/api/v1/billing/storage") return json(request.url, { used: 2e9, limit: 2e9, level: state.storageLevel, blocks_at_limit: true, warning_levels: [90, 100], can_manage: true,
      items: [{ result_id: "r1", project_name: "Rufiji", result_type: "flood_extent_map", created_at: "2026-11-01T00:00:00Z", bytes: 1.8e9, files: 2, confirmation_code: "abcd1234",
        downloads: ["/api/v1/results/r1/products/map", "/api/v1/results/r1/products/report"] }] });
    if (path === "/api/v1/billing/payments") return json(request.url, { total: 1, limit: 20, offset: 0, items: [{ id: "p1", created_at: "2026-11-21T08:00:00Z", paid_on: "2026-11-21",
      family: "frris_wrris", purpose: "top_up", amount: 150000, currency: "TZS", method: "mobile_money", reference: "MM-1", credits: 10, covers_from: null, covers_until: null,
      reverses_payment_id: null, reversed: false, receipt_number: "R-000007" }] });
    if (path === "/api/v1/account/sessions") return json(request.url, { session_limit: 1, location_attribution: null, items: [] });
    if (path === "/api/v1/billing/abliner/offers") return json(request.url, { enabled: false, offers: [] });
    if (path === "/auth/config") return json(request.url, { configured: true, message: null });
    if (path.startsWith("/api/v1/billing/ledger") || path.startsWith("/api/v1/billing/plans")) return json(request.url, { items: [], total: 0, limit: 20, offset: 0, plans: [], family: "frris_wrris" });
    return json(request.url, path.endsWith("requests") || path.endsWith("login-history") ? (path.endsWith("requests") ? [] : { items: [] }) : {});
  }));
});
afterEach(() => vi.unstubAllGlobals());

const page = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter initialEntries={["/subscription"]}><SubscriptionPage /></MemoryRouter></QueryClientProvider>);

it("Q5: warns at 90% everywhere and frees space only after typing the code", async () => {
  state.storageLevel = 90;
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/frris/analyses"]}><SubscriptionBanner /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("status")).toHaveTextContent(/Storage is 90% used/);
  state.storageLevel = 100;
  page();
  const card = await screen.findByRole("region", { name: "Storage" });
  expect(await within(card).findByRole("alert")).toHaveTextContent(/New analyses are paused.*still view and download/);
  fireEvent.click(within(card).getByRole("button", { name: "Free up space" }));
  const dialog = await screen.findByRole("dialog", { name: "Free up space" });
  expect(within(dialog).getByRole("link", { name: "Download 1" })).toHaveAttribute("href", "/api/v1/results/r1/products/map");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete files…" }));
  const remove = within(dialog).getByRole("button", { name: "Delete files" });
  expect(remove).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/to confirm/), { target: { value: "abcd1234" } });
  fireEvent.click(remove);
  await waitFor(() => expect(posts).toEqual([{ path: "/api/v1/billing/storage/results/r1/delete-files", body: { confirm: "abcd1234" } }]));
});

it("Q5b: requests extra storage from NOVA ARI", async () => {
  page();
  const card = await screen.findByRole("region", { name: "Storage" });
  fireEvent.change(await within(card).findByLabelText(/Extra storage/), { target: { value: "5" } });
  fireEvent.click(within(card).getByRole("button", { name: "Request extra storage" }));
  await waitFor(() => expect(posts).toEqual([{ path: "/api/v1/billing/requests", body: { subscription_id: SUB, kind: "storage", storage_gb: 5 } }]));
});

it("Q6/Q9: receipts, seller identity and the privacy notice", async () => {
  page();
  expect(await screen.findByRole("link", { name: "R-000007 (PDF)" })).toHaveAttribute("href", "/api/v1/billing/payments/p1/receipt");
  expect(screen.getByText(/Sold by Seller Placeholder Ltd · TIN 100-000-000.*VAT is not charged.*not TRA fiscal receipts/)).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Your sessions" })).getByText(PRIVACY_NOTICE)).toBeInTheDocument();
});

it("Q7: an expired plan says when access closes and offers Renew; top-ups wait for renewal", async () => {
  state = { status: "expired", storageLevel: null, blockCode: "subscription_expired" };
  page();
  const plan = await screen.findByRole("region", { name: /Researcher/ });
  expect(within(plan).getByRole("alert")).toHaveTextContent(/New analyses are stopped.*view and download your results until.*Renew the plan/);
  expect(screen.getByRole("region", { name: "Buy additional credits" })).toHaveTextContent(/Renew your plan first/);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/frris/analyses"]}><SubscriptionBanner /></MemoryRouter></QueryClientProvider>);
  await waitFor(() => expect(screen.getAllByRole("link", { name: "Renew plan" }).map((link) => link.getAttribute("href")))
    .toContain("/subscription#renew"));
});

it("Q9: the sign-in page shows the privacy notice", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/login"]}><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText(PRIVACY_NOTICE)).toBeInTheDocument();
});
