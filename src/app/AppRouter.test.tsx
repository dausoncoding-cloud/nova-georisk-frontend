import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLoginUrl, sanitizeReturnTo } from "../features/auth/authNavigation";
import { fetchTasks } from "../features/tasks/tasksApi";
import { AppRouter } from "./AppRouter";

const auth = vi.hoisted(() => ({ authenticated: true }));
const org = { id: "11111111-1111-4111-8111-111111111111", name: "Org One", slug: "org-one" };

vi.mock("../features/auth/authApi", () => ({
  fetchAuthConfig: vi.fn(async () => ({ configured: true, message: "" })),
  fetchSession: vi.fn(async () => auth.authenticated
    ? { authenticated: true, csrfToken: "t", organization: { id: org.id, name: org.name }, roles: ["analyst"], user: { id: "u", displayName: "Session User", email: "user@example.test" } }
    : { authenticated: false, csrfToken: null, organization: null, roles: [], user: null }),
  logout: vi.fn(),
}));
vi.mock("../features/organization/organizationApi", () => ({
  fetchOrganizationContext: vi.fn(async () => ({ user: { id: "u", display_name: "Session User", email: "user@example.test" }, current_organization: org, current_role: "analyst", memberships: [{ organization: org, role: "analyst", created_at: "2026-01-01T00:00:00Z" }] })),
}));
vi.mock("../features/engines/enginesApi", () => ({ fetchEngines: vi.fn(async () => [{ key: "firris", access: true }]), fetchEngineContract: vi.fn() }));
vi.mock("../features/tasks/tasksApi", async (load) => ({ ...await load<typeof import("../features/tasks/tasksApi")>(), fetchTasks: vi.fn(async () => ({ items: [], total: 0, limit: 50, offset: 0 })) }));
vi.mock("../features/projects/projectsApi", async (load) => ({ ...await load<typeof import("../features/projects/projectsApi")>(), fetchProjects: vi.fn(async () => []) }));
vi.mock("../features/results/resultsApi", async (load) => ({ ...await load<typeof import("../features/results/resultsApi")>(), fetchResults: vi.fn(async () => ({ items: [], total: 0, limit: 8, offset: 0 })) }));

function Where() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

function renderApp(entry: string | { pathname: string; state?: unknown }) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}><AppRouter /><Where /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const location = () => screen.getByTestId("location").textContent;

beforeEach(() => {
  auth.authenticated = true;
  vi.mocked(fetchTasks).mockClear();
});

describe("post-login landing", () => {
  it("sends the BFF login to the suite home when there is no deep link", () => {
    // The BFF callback redirects to return_to; without a deep link that is "/".
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(buildLoginUrl(sanitizeReturnTo(undefined))).toBe("/auth/login?return_to=%2F");
  });

  it("lands on the suite home after the callback redirect to /, without errors", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Your systems" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open FRRIS" })).toHaveAttribute("href", "/frris");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(location()).toBe("/");
  });

  it("an already signed-in visit to /login goes to the suite home", async () => {
    renderApp("/login");
    expect(await screen.findByRole("heading", { level: 1, name: "Your systems" })).toBeInTheDocument();
    expect(location()).toBe("/");
  });

  it("keeps a deep link through sign-in", async () => {
    renderApp("/login?return_to=%2Ffrris%2Foverview");
    await waitFor(() => expect(location()).toBe("/frris/overview"));
  });

  it("an unauthenticated visit to the suite home asks to sign in and returns there", async () => {
    auth.authenticated = false;
    renderApp("/");
    expect(await screen.findByRole("button", { name: "Continue with SSO" })).toBeInTheDocument();
    expect(location()).toBe("/login");
  });
});

describe("moved routes", () => {
  it("/frris opens the FRRIS Analyses list", async () => {
    renderApp("/frris");
    await waitFor(() => expect(location()).toBe("/frris/analyses"));
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("old /tasks links redirect to the Analyses list and keep their filters", async () => {
    renderApp("/tasks?status=failed&offset=50#list");
    await waitFor(() => expect(location()).toBe("/frris/analyses?status=failed&offset=50#list"));
    await waitFor(() => expect(fetchTasks).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", offset: 50 })));
  });

  it("old /analyses links open New analysis and keep their query", async () => {
    renderApp("/analyses?project=p1");
    await waitFor(() => expect(location()).toBe("/frris/analyses/new?project=p1"));
  });

  it("New analysis is the FRRIS builder", async () => {
    renderApp("/frris/analyses/new");
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New analysis" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Analyses/ })).not.toHaveAttribute("aria-current");
  });

  it("the former dashboard is reachable as FRRIS Overview", async () => {
    renderApp("/frris/overview");
    expect(await screen.findByText("Operations overview")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/frris/analyses");
  });

  it.each(["/projects", "/results", "/data", "/settings"])("unchanged route %s still renders in the FRRIS shell", async (path) => {
    renderApp(path);
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(location()).toBe(path);
  });
});
