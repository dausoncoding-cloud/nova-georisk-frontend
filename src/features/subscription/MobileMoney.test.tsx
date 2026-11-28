// Abliner M3: "Pay with Mobile Money" is shown only when the server enables it, sends the number with an
// Idempotency-Key, and shows "waiting" until the server, not the browser, reports the result.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileMoneyPay, normalisePhone } from "./MobileMoney";
import type { Subscription } from "./subscriptionApi";

const subscription = { id: "s1", family: "frris_wrris", plan_name: "Professional", is_internal: false } as unknown as Subscription;
let enabled = true;
let created: Record<string, unknown> | null = null;
let status = "pending";
const posts: { headers: Headers; body: unknown }[] = [];
const json = (url: string, body: unknown, code = 200) => {
  const response = new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
};
const intent = () => ({ id: "i1", subscription_id: "s1", purpose: "top_up", amount: 100000, currency: "TZS", credits: 10,
  phone: "2557•••••678", status, created_at: new Date().toISOString(), reference: "NOVA-ABCD1234",
  message: status === "pending" ? "Check your phone and approve the payment." : "Payment received. 10 credits added." });

beforeEach(() => {
  enabled = true; created = null; status = "pending"; posts.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method === "POST") { posts.push({ headers: request.headers, body: await request.clone().json() }); created = intent(); return json(request.url, created, 201); }
    if (path.endsWith("/abliner/offers")) return json(request.url, { enabled, offers: [{ purpose: "top_up", available: true, amount: 100000,
      currency: "TZS", credits: 10, covers_from: null, covers_until: null, unavailable_message: null }] });
    if (path.endsWith("/abliner/payments")) return json(request.url, created ? [intent()] : []);
    if (path.endsWith("/abliner/payments/i1")) return json(request.url, intent());
    return json(request.url, {}, 404);
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = (canManage = true) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MobileMoneyPay subscription={subscription} purpose="top_up" canManage={canManage} /></QueryClientProvider>);

it("accepts Tanzanian mobile numbers only", () => {
  expect(normalisePhone("0712 345 678")).toBe("0712345678");
  expect(normalisePhone("+255 612-345-678")).toBe("+255612345678");
  expect(normalisePhone("0812345678")).toBeNull();
  expect(normalisePhone("071234567")).toBeNull();
});

it("is hidden while the switch is off and for members", async () => {
  enabled = false;
  const { container } = show();
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
  enabled = true;
  const member = show(false);
  expect(member.container).toBeEmptyDOMElement();
});

it("pays with an Idempotency-Key and waits for the server's result", async () => {
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Pay with Mobile Money" }));
  const dialog = await screen.findByRole("dialog", { name: "Pay with Mobile Money" });
  expect(dialog).toHaveTextContent("TZS 100,000 for 10 credits.");
  fireEvent.change(within(dialog).getByLabelText(/Mobile Money number/), { target: { value: "0812" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Pay TZS 100,000" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Tanzanian mobile number/);
  expect(posts).toHaveLength(0);
  fireEvent.change(within(dialog).getByLabelText(/Mobile Money number/), { target: { value: "0712 345 678" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Pay TZS 100,000" }));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]?.body).toEqual({ subscription_id: "s1", purpose: "top_up", phone: "0712 345 678" });
  expect(posts[0]?.headers.get("Idempotency-Key")).toBeTruthy();
  const waiting = await screen.findByRole("status");
  expect(waiting).toHaveTextContent(/Waiting for approval….*Check your phone.*2557•••••678/);
  expect(screen.queryByRole("button", { name: "Pay with Mobile Money" })).toBeNull();
  status = "completed";
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Payment received.*10 credits added/), { timeout: 8000 });
  expect(await screen.findByRole("button", { name: "Pay with Mobile Money" }, { timeout: 5000 })).toBeInTheDocument();
}, 15000);
