// Subscriptions M5: "My subscription" (board 13), the limit-reached banner and the New analysis credit notice.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreditNotice, SubscriptionBanner } from "./SubscriptionNotices";
import { SubscriptionPage } from "./SubscriptionPage";

const role = vi.hoisted(() => ({ value: "owner" }));
vi.mock("../organization/OrganizationContext", () => ({
  useOrganizationContext: () => ({ current_role: role.value, current_organization: { id: "o", name: "Rufiji Basin" }, user: { id: "u" }, memberships: [] }),
}));

const SUB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NO_CREDITS = "Your monthly analysis allowance has been reached. New analyses are paused until renewal; you can still view and download your results.";
let state = { used: 7, remaining: 3, level: null as number | null, enforced: true };
let calls: { method: string; path: string; body: unknown }[] = [];

const subscription = () => ({
  id: SUB, family: "frris_wrris", plan_key: "frris_wrris.researcher", plan_name: "Researcher", is_internal: false, status: "active",
  status_label: "Active", starts_at: null, ends_at: null, engines: ["firris"], currency: "TZS", monthly_price: 150000,
  limits: { seat_limit: 1, monthly_credits: 10, storage_bytes: 2_000_000_000, session_limit: 1 }, seats_used: 1,
  renews_on: "2026-12-01T00:00:00+03:00", warning_levels: [75, 90], top_up: { credits: 10, price: 100000, currency: "TZS" },
  credits: { period: "2026-11", granted: 10, top_ups: 0, used: state.used, remaining: state.remaining, available: 10,
    used_percent: state.used * 10, level: state.level, unlimited: false },
  can_submit: state.remaining > 0, block_code: state.remaining > 0 ? null : "credits_exhausted", block_message: state.remaining > 0 ? null : NO_CREDITS,
});

const json = (url: string, body: unknown, status = 200) => {
  const response = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
};

beforeEach(() => {
  role.value = "owner";
  state = { used: 7, remaining: 3, level: null, enforced: true };
  calls = [];
  let requested = false;
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    const body = request.method === "GET" ? null : await request.clone().json().catch(() => null);
    calls.push({ method: request.method, path, body });
    if (path === "/api/v1/billing/summary") return json(request.url, { enforcement_enabled: state.enforced, subscriptions: [subscription()], seats: { used: 1, limit: 1, level: 100 }, storage: { used: 600_000_000, limit: 2_000_000_000, level: null }, storage_blocks_at_limit: false });
    if (path === "/api/v1/billing/ledger") return json(request.url, { total: 4, limit: 20, offset: 0, items: [
      { id: "1", created_at: "2026-11-20T09:00:00Z", period: "2026-11", kind: "charge", bucket: "monthly", amount: -1, balance_after: 3, task_id: "t1", label: "Analysis", project_name: "Rufiji", aoi_name: "Rufiji floodplain 2024", plan_name: null },
      { id: "2", created_at: "2026-11-19T09:00:00Z", period: "2026-11", kind: "refund", bucket: "monthly", amount: 1, balance_after: 4, task_id: "t2", label: "Refund · analysis stopped (not enough valid satellite data)", project_name: null, aoi_name: null, plan_name: null },
      { id: "3", created_at: "2026-11-01T00:00:00Z", period: "2026-11", kind: "monthly_grant", bucket: "monthly", amount: 10, balance_after: 10, task_id: null, label: "Monthly allowance", project_name: null, aoi_name: null, plan_name: "Researcher" },
    ] });
    if (path === "/api/v1/billing/plans") return json(request.url, { family: "frris_wrris", plans: [
      { key: "frris_wrris.researcher", family: "frris_wrris", name: "Researcher", is_custom: false, currency: "TZS", monthly_price: 150000, limits: { seat_limit: 1, monthly_credits: 10, storage_bytes: 2e9, session_limit: 1 } },
      { key: "frris_wrris.professional", family: "frris_wrris", name: "Professional", is_custom: false, currency: "TZS", monthly_price: 300000, limits: { seat_limit: 5, monthly_credits: 30, storage_bytes: 5e9, session_limit: 3 } },
    ] });
    if (path === "/api/v1/billing/requests" && request.method === "POST") { requested = true; return json(request.url, { id: "r1", subscription_id: SUB, kind: "top_up", plan_key: null, plan_name: null, credits: 10, status: "open", created_at: "2026-11-20T10:00:00Z", closed_at: null, existing: false }, 201); }
    if (path === "/api/v1/billing/requests") return role.value === "viewer" ? json(request.url, { error: { code: "billing_role_required" } }, 403)
      : json(request.url, requested ? [{ id: "r1", subscription_id: SUB, kind: "top_up", plan_key: null, plan_name: null, credits: 10, status: "open", created_at: "2026-11-20T10:00:00Z", closed_at: null, existing: false }] : []);
    if (path === "/api/v1/billing/payments") return json(request.url, { items: [], total: 0, limit: 20, offset: 0 });
    if (path === "/api/v1/account/sessions") return json(request.url, { session_limit: 1, location_attribution: null, items: [
      { id: "s1", created_at: "2026-11-20T08:00:00Z", last_seen_at: "2026-11-20T09:00:00Z", expires_at: "2026-11-20T16:00:00Z", browser: "Chrome", os: "Windows", device_type: "desktop", location: "Dar es Salaam, Tanzania", country_code: "TZ", organization_name: "Rufiji Basin", current: true },
    ] });
    if (path === "/api/v1/account/login-history") return json(request.url, { items: [], total: 0, limit: 10, offset: 0 });
    return json(request.url, {}, 404);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderWith(node: React.ReactNode, path = "/subscription") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{node}</MemoryRouter></QueryClientProvider>);
}

describe("My subscription", () => {
  it("shows the plan, credits, credit activity, sessions and plans as on the board", async () => {
    renderWith(<SubscriptionPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "My subscription" })).toBeInTheDocument();
    const plan = screen.getByRole("region", { name: "FRRIS Researcher" });
    expect(plan).toHaveTextContent("TZS 150,000 / month");
    expect(plan).toHaveTextContent(/Authorised users1 of 1/);
    await waitFor(() => expect(plan).toHaveTextContent(/Active sessions1 \/ 1/));
    expect(plan).toHaveTextContent(/Storage0\.6 GB of 2 GB/);
    const credits = screen.getByRole("region", { name: "Analysis credits this period" });
    expect(credits).toHaveTextContent("7 / 10 credits used");
    expect(credits).toHaveTextContent("3 credits remaining");
    expect(credits).toHaveTextContent("Warnings at 75% and 90%");
    expect(within(credits).getByRole("link", { name: "Run new analysis" })).toBeInTheDocument();
    expect(await screen.findByText("Analysis · Rufiji floodplain 2024")).toBeInTheDocument();
    expect(screen.getByText("Refund · analysis stopped (not enough valid satellite data)")).toBeInTheDocument();
    expect(screen.getByText("Monthly allowance · Researcher plan")).toBeInTheDocument();
    expect(screen.getByText("Signing in and viewing results never uses credits.")).toBeInTheDocument();
    expect(await screen.findByText("This device · Chrome, Windows")).toBeInTheDocument();
    expect(screen.getByText("The Researcher plan allows one active session for one authorised user.")).toBeInTheDocument();
    const plans = await screen.findByRole("region", { name: "Plans for FRRIS and WRRIS" });
    expect(within(plans).getByText("Current plan")).toBeInTheDocument();
    expect(within(plans).getByRole("button", { name: "Request upgrade" })).toBeInTheDocument();
  });

  it("at 100% shows the limit-reached banner and stops new analyses, but nothing else", async () => {
    state = { used: 10, remaining: 0, level: 100, enforced: true };
    renderWith(<SubscriptionPage />);
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(NO_CREDITS);
    expect(within(banner).getByRole("link", { name: "Buy credits" })).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: "Upgrade plan" })).toBeInTheDocument();
    const credits = screen.getByRole("region", { name: "Analysis credits this period" });
    expect(within(credits).getByRole("button", { name: "Run new analysis" })).toBeDisabled();
    expect(within(credits).getByRole("link", { name: "Buy credits" })).toBeInTheDocument();
  });

  it("lets an owner request a top-up once, and shows it as requested", async () => {
    renderWith(<SubscriptionPage />);
    const button = await screen.findByRole("button", { name: "Request top-up" });
    fireEvent.click(button);
    await waitFor(() => expect(calls.some((call) => call.method === "POST" && call.path === "/api/v1/billing/requests")).toBe(true));
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ subscription_id: SUB, kind: "top_up" });
    expect(await screen.findByRole("button", { name: "Requested" })).toBeDisabled();
    expect(screen.getByText(/NOVA ARI will send payment details to the account owner/)).toBeInTheDocument();
  });

  it("does not offer requests to a viewer", async () => {
    role.value = "viewer";
    renderWith(<SubscriptionPage />);
    expect(await screen.findByText("Ask your organisation's owner or admin to request a top-up.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request top-up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Request upgrade" })).toBeNull();
  });
});

describe("banners and the New analysis notice", () => {
  it("warns at 75% and 90% in the app layout", async () => {
    state = { used: 8, remaining: 2, level: 75, enforced: true };
    renderWith(<SubscriptionBanner />, "/frris/analyses");
    expect(await screen.findByRole("status")).toHaveTextContent("You have used 8 of 10 analysis credits this month (75%). 2 remaining.");
  });

  it("shows nothing while limits are not enforced", async () => {
    state = { used: 10, remaining: 0, level: 100, enforced: false };
    renderWith(<><SubscriptionBanner /><CreditNotice /></>, "/frris/analyses");
    await waitFor(() => expect(calls.some((call) => call.path === "/api/v1/billing/summary")).toBe(true));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells the user what a run costs, or why it cannot start", async () => {
    renderWith(<CreditNotice />);
    expect(await screen.findByRole("status")).toHaveTextContent("Running this analysis uses 1 credit. 3 credits remaining this month.");
  });

  it("explains the hard stop before the user fills the form", async () => {
    state = { used: 10, remaining: 0, level: 100, enforced: true };
    renderWith(<CreditNotice />);
    expect(await screen.findByRole("alert")).toHaveTextContent(NO_CREDITS);
  });
});
