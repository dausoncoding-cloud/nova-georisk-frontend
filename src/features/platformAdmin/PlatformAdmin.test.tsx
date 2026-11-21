// Subscriptions M4: the NOVA ARI console (board 14).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomersPage } from "./CustomersPage";
import { PlatformAdminLayout } from "./PlatformAdminLayout";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_D = "44444444-4444-4444-8444-444444444444";
const SUB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUB_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const row = (overrides: Record<string, unknown>) => ({
  organization_id: ORG_A, organization_name: "Customer A", organization_slug: "customer-a", subscription_id: SUB_A,
  family: "frris_wrris", systems: ["FRRIS", "WRRIS"], plan_key: "frris_wrris.researcher", plan_name: "Researcher",
  is_internal: false, status: "active", users_used: 1, users_limit: 1, active_sessions: 1, session_limit: 1,
  credits_used: 7, credits_available: 10, credits_unlimited: false, storage_used: 400_000_000, storage_limit: 2_000_000_000,
  ends_at: null, renews_on: "2026-12-01T00:00:00+03:00", flags: ["new_device"], ...overrides,
});

type Call = { method: string; path: string; body: unknown; headers: Headers };
let calls: Call[] = [];
let admin = true;
let failPaymentOnce = false;

const json = (url: string, body: unknown, status = 200) => {
  const response = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
};

beforeEach(() => {
  calls = [];
  admin = true;
  failPaymentOnce = false;
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const body = request.method === "GET" ? null : await request.clone().json().catch(() => null);
    calls.push({ method: request.method, path: url.pathname, body, headers: request.headers });
    const path = url.pathname.replace("/api/v1/platform-admin", "");
    if (path === "/access") return admin
      ? json(request.url, { display_name: "Asha Admin", email: "asha@novarex.example", organization_name: "NOVAREX" })
      : json(request.url, { error: { code: "platform_admin_required", message: "NOVA ARI administration access is required." } }, 403);
    if (path === "/overview") return json(request.url, { active_subscriptions: 12, expiring_soon: 2, expiring_soon_days: 7, credits_used_this_month: 340, open_security_alerts: 3, payments_overdue: 1, customers: 14, period: "2026-11" });
    if (path === "/customers") return json(request.url, { total: 2, limit: 50, offset: 0, items: [
      row({}),
      row({ organization_id: ORG_D, organization_name: "Customer D", organization_slug: "customer-d", subscription_id: SUB_D, plan_name: "Academic / Department", status: "suspended", users_limit: 10, flags: ["payment_overdue", "suspended"] }),
    ] });
    if (path.startsWith("/customers/") && path.endsWith("/login-history")) return json(request.url, { total: 2, limit: 10, offset: 0, location_attribution: "IP geolocation by DB-IP", items: [
      { id: "s2", created_at: "2026-11-20T11:02:00Z", user_id: "u", user_display_name: "Amina", user_email: null, browser: "Chrome", os: "Windows", device_type: "desktop", location: "Dar es Salaam, Tanzania", country_code: "TZ", ip_address: "41.59.10.20", result: "active", ended_at: null, is_new_device: true, ended_earlier_sessions: 1 },
      { id: "s1", created_at: "2026-11-19T08:00:00Z", user_id: "u", user_display_name: "Amina", user_email: null, browser: "Firefox", os: "Linux", device_type: "desktop", location: null, country_code: null, ip_address: null, result: "replaced", ended_at: "2026-11-20T11:02:00Z", is_new_device: false, ended_earlier_sessions: 0 },
    ] });
    if (path.startsWith("/customers/")) return json(request.url, { organization_id: ORG_A, organization_name: "Customer A", organization_slug: "customer-a", created_at: "2026-01-01T00:00:00Z", rows: [], members: [], open_alerts: 1,
      subscriptions: [{ id: SUB_A, credits: { remaining: 3, unlimited: false } }],
      usage: { period: "2026-11", analyses_run: 7, data_processed_bytes: 2_400_000_000, api_requests: 1830, downloads: 5, download_bytes: 1, registered_devices: 2 } });
    if (path.endsWith("/payments") && request.method === "POST") {
      if (failPaymentOnce) { failPaymentOnce = false; return json(request.url, { error: { code: "http_503", message: "Unavailable" } }, 503); }
      return json(request.url, { payment: { id: "p1" }, ledger_entry_id: null, replayed: false }, 201);
    }
    if (path.endsWith("/status")) return json(request.url, row({ status: "suspended" }));
    if (path === "/plans") return json(request.url, [
      { key: "frris_wrris.researcher", family: "frris_wrris", name: "Researcher", is_custom: false, is_internal: false, unlimited_credits: false, limits: { seat_limit: 1, monthly_credits: 10, storage_bytes: 2e9, session_limit: 1 }, refund_on_data_failure: false, currency: "TZS", monthly_price: 150000, top_up_credit_price: 10000, price_version: 1, subscriptions: 3 },
      { key: "frris_wrris.professional", family: "frris_wrris", name: "Professional", is_custom: false, is_internal: false, unlimited_credits: false, limits: { seat_limit: 5, monthly_credits: 30, storage_bytes: 5e9, session_limit: 3 }, refund_on_data_failure: false, currency: "TZS", monthly_price: 300000, top_up_credit_price: 10000, price_version: 1, subscriptions: 1 },
    ]);
    if (path === "/customers" && request.method === "POST") return json(request.url, { organization_id: ORG_A, subscription_id: SUB_A, owner_user_id: null }, 201);
    return json(request.url, {}, 404);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderConsole() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/nova-ari"]}>
        <Routes><Route path="nova-ari" element={<PlatformAdminLayout />}><Route index element={<CustomersPage />} /></Route></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const posts = (suffix: string) => calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

describe("NOVA ARI console", () => {
  it("is closed to anyone who is not a platform admin, and asks for nothing else", async () => {
    admin = false;
    renderConsole();
    expect(await screen.findByText("This area is for NOVA ARI platform administrators.")).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toEqual(["/api/v1/platform-admin/access"]);
  });

  it("shows the tiles, the customers table with flags, usage and login history as on the board", async () => {
    renderConsole();
    expect(await screen.findByRole("heading", { level: 1, name: "Customers and subscriptions" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Administration" })).toHaveTextContent(/Customers.*Payments.*Plans and pricing.*Security alerts.*Audit log/);
    const tiles = screen.getByRole("region", { name: "Summary" });
    await waitFor(() => expect(tiles).toHaveTextContent("Active subscriptions12"));
    expect(tiles).toHaveTextContent("Open security alerts3");
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent(/Customer A.*FRRIS · WRRIS.*Researcher.*Active.*1 \/ 1.*1 \/ 1.*7 \/ 10.*0\.4 GB \/ 2 GB.*New device/);
    expect(rows[2]).toHaveTextContent(/Customer D.*Suspended.*Payment overdue/);
    expect(await screen.findByRole("heading", { name: "Customer A · usage this period" })).toBeInTheDocument();
    const usage = await screen.findByText("Analyses run");
    expect(usage.closest("dl")).toHaveTextContent(/Analyses run7.*Credits remaining3.*Data processed2\.40 GB.*Downloads5.*API requests1,830.*Registered devices2/);
    expect(await screen.findByText("Ended earlier session")).toBeInTheDocument();
    // Audited view: fetched with POST, so it carries the CSRF token (security review L4).
    expect(calls.filter((call) => call.path.endsWith("/login-history")).map((call) => call.method)).toEqual(["POST"]);
    expect(screen.getByText(/IP geolocation by DB-IP/)).toBeInTheDocument();
    expect(screen.getByText("Every admin action is written to the audit log with the admin's name and a reason.")).toBeInTheDocument();
  });

  it("will not suspend without a reason, and sends the reason", async () => {
    renderConsole();
    fireEvent.click(await screen.findByRole("button", { name: "Suspend account" }));
    const dialog = await screen.findByRole("dialog", { name: "Suspend account · Customer A" });
    const confirm = within(dialog).getByRole("button", { name: "Suspend account" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Unpaid invoice 14" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(posts("/status")).toHaveLength(1));
    expect(posts("/status")[0].body).toEqual({ status: "suspended", reason: "Unpaid invoice 14", change_ends_at: false });
  });

  it("records a payment with one Idempotency-Key, reused only after a server error", async () => {
    failPaymentOnce = true;
    renderConsole();
    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }));
    const dialog = await screen.findByRole("dialog", { name: "Record payment · Customer A" });
    fireEvent.click(within(dialog).getByLabelText("Top-up credits"));
    fireEvent.change(within(dialog).getByLabelText("Amount (TZS)"), { target: { value: "100000" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Top-up pack, M-Pesa" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(posts("/payments")).toHaveLength(2));
    const [first, second] = posts("/payments");
    expect(first.headers.get("Idempotency-Key")).toMatch(/^nova-/);
    expect(second.headers.get("Idempotency-Key")).toBe(first.headers.get("Idempotency-Key"));
    expect(first.body).toMatchObject({ purpose: "top_up", amount: 100000, credits: 10, method: "bank_transfer", note: "Top-up pack, M-Pesa" });
  });

  it("adds a customer with a short name made from the name", async () => {
    renderConsole();
    fireEvent.click(await screen.findByRole("button", { name: "Add customer" }));
    const dialog = await screen.findByRole("dialog", { name: "Add customer" });
    fireEvent.change(within(dialog).getByLabelText("Organisation name"), { target: { value: "Rufiji Basin Office" } });
    await waitFor(() => expect(within(dialog).getByLabelText("Plan")).toHaveValue("frris_wrris.researcher"));
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Contract RB-14" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add customer" }));
    await waitFor(() => expect(calls.some((call) => call.method === "POST" && call.path === "/api/v1/platform-admin/customers")).toBe(true));
    const created = calls.find((call) => call.method === "POST" && call.path === "/api/v1/platform-admin/customers");
    expect(created?.body).toMatchObject({ name: "Rufiji Basin Office", slug: "rufiji-basin-office", family: "frris_wrris", plan_key: "frris_wrris.researcher", reason: "Contract RB-14" });
  });
});
