import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedLayout, COMPACT_QUERY } from "./AuthenticatedLayout";

vi.mock("../features/auth/authQueries", () => ({
  useSession: () => ({ data: { authenticated: true, user: { id: "u", displayName: "Session User", email: "user@example.test" } } }),
}));
vi.mock("../features/organization/OrganizationContext", () => ({
  useOrganizationContext: () => ({
    current_role: "analyst",
    current_organization: { id: "org-1", name: "Org One", slug: "org-one" },
    user: { id: "u", display_name: null, email: null },
    memberships: [{ organization: { id: "org-1", name: "Org One", slug: "org-one" }, role: "analyst", created_at: "2026-01-01T00:00:00Z" }],
  }),
}));
vi.mock("../features/tasks/tasksApi", () => ({ fetchTasks: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }) }));

let viewportIsCompact = true;
const listeners = new Set<() => void>();
function setViewport(compact: boolean) {
  viewportIsCompact = compact;
  act(() => listeners.forEach((listener) => listener()));
}

beforeEach(() => {
  viewportIsCompact = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query === COMPACT_QUERY ? viewportIsCompact : !viewportIsCompact; },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
});
afterEach(() => { vi.unstubAllGlobals(); listeners.clear(); });

function Where() { const location = useLocation(); return <output data-testid="location">{location.pathname}</output>; }

function renderShell(path = "/frris/analyses") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AuthenticatedLayout />}>
            <Route path="*" element={<p>page content</p>} />
          </Route>
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function openDrawer() {
  const button = screen.getByRole("button", { name: "Open menu" });
  button.focus();
  fireEvent.click(button);
  return { button, drawer: screen.getByRole("dialog", { name: "Menu" }) };
}

describe("compact navigation (< 900 px)", () => {
  it("shows a top bar with the brand, the current system and a menu button; the sidebar is closed", () => {
    renderShell();
    const topbar = screen.getByRole("banner");
    expect(within(topbar).getByRole("link", { name: "NOVA-GeoRisk, all systems" })).toHaveAttribute("href", "/");
    expect(within(topbar).getByText("FRRIS")).toBeInTheDocument();
    expect(within(topbar).getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".fr-sidebar")).toHaveAttribute("inert");
  });

  it("opens the drawer as a modal dialog with focus inside and trapped", () => {
    renderShell();
    const { button, drawer } = openDrawer();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).not.toHaveAttribute("inert");
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(within(drawer).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    // Shift+Tab from the first element wraps to the last, Tab from the last wraps to the first.
    const first = document.activeElement as HTMLElement;
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    const last = document.activeElement as HTMLElement;
    expect(last).not.toBe(first);
    expect(drawer.contains(last)).toBe(true);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("closes with Escape and returns focus to the menu button", () => {
    renderShell();
    const { button } = openDrawer();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the backdrop or the close button is used, returning focus to the menu button", () => {
    renderShell();
    let { button } = openDrawer();
    fireEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
    ({ button } = openDrawer());
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("closes on navigation", () => {
    renderShell();
    const { drawer } = openDrawer();
    fireEvent.click(within(drawer).getByRole("link", { name: "Data catalog" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/data");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the viewport grows to desktop", () => {
    renderShell();
    openDrawer();
    setViewport(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".fr-sidebar")).not.toHaveAttribute("inert");
  });
});

describe("desktop navigation (>= 900 px)", () => {
  it("renders the sidebar as plain navigation, never as a dialog", () => {
    viewportIsCompact = false;
    renderShell();
    const sidebar = document.querySelector(".fr-sidebar")!;
    expect(sidebar).not.toHaveAttribute("role");
    expect(sidebar).not.toHaveAttribute("inert");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
