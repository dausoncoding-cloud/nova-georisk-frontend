import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedLayout } from "./AuthenticatedLayout";
import { SuiteHomePage } from "./SuiteHomePage";
import { SUITE_SYSTEMS, systemAvailability } from "./suiteSystems";

const state = vi.hoisted(() => ({
  role: "analyst",
  memberships: 1,
  engines: undefined as undefined | { key: string; access: boolean }[],
}));

vi.mock("../features/auth/authQueries", () => ({
  useSession: () => ({ data: { authenticated: true, user: { id: "u", displayName: "Session User", email: "user@example.test" } } }),
}));
vi.mock("../features/organization/OrganizationContext", () => ({
  useOrganizationContext: () => ({
    current_role: state.role,
    current_organization: { id: "org-1", name: "Org One", slug: "org-one" },
    user: { id: "u", display_name: null, email: null },
    memberships: Array.from({ length: state.memberships }, (_, index) => ({ organization: { id: `org-${index + 1}`, name: `Org ${index + 1}`, slug: "o" }, role: state.role, created_at: "2026-01-01T00:00:00Z" })),
  }),
}));
vi.mock("../features/engines/engineQueries", () => ({ useAvailableEngines: () => ({ data: state.engines }) }));
vi.mock("../features/tasks/tasksApi", () => ({ fetchTasks: vi.fn().mockResolvedValue({ items: [], total: 2, limit: 20, offset: 0 }) }));

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route index element={<SuiteHomePage />} />
          <Route element={<AuthenticatedLayout />}>
            <Route path="*" element={<p>page content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.role = "analyst";
  state.memberships = 1;
  state.engines = [{ key: "firris", access: true }];
});

describe("system availability", () => {
  it("takes FRRIS access from the engines API and never activates systems in development", () => {
    const [frris, wrris, megis] = SUITE_SYSTEMS;
    expect(systemAvailability(frris!, [{ key: "firris", access: true }])).toBe("active");
    expect(systemAvailability(frris!, [{ key: "firris", access: false }])).toBe("not-enabled");
    expect(systemAvailability(frris!, [])).toBe("not-enabled");
    expect(systemAvailability(frris!, undefined)).toBe("unknown");
    expect(systemAvailability(wrris!, [{ key: "wrris", access: true }])).toBe("in-development");
    expect(systemAvailability(megis!, undefined)).toBe("in-development");
  });
});

describe("Suite home", () => {
  it("links to FRRIS when the organization has access, and shows WRRIS/MEGIS as in development without links", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Your systems" })).toBeInTheDocument();
    const frris = screen.getByRole("article", { name: "FRRIS" });
    expect(within(frris).getByText("Active")).toBeInTheDocument();
    expect(within(frris).getByRole("link", { name: "Open FRRIS" })).toHaveAttribute("href", "/frris");
    for (const name of ["WRRIS", "MEGIS"]) {
      const card = screen.getByRole("article", { name });
      expect(within(card).getByText("In development")).toBeInTheDocument();
      expect(within(card).queryByRole("link")).toBeNull();
      expect(within(card).queryByRole("button")).toBeNull();
    }
    expect(screen.getByText("Session User · Org One")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\[[^\]]*\]/); // no design placeholders
  });

  it("does not offer FRRIS when the organization is not entitled to it", () => {
    state.engines = [{ key: "firris", access: false }];
    renderAt("/");
    const frris = screen.getByRole("article", { name: "FRRIS" });
    expect(within(frris).queryByRole("link")).toBeNull();
    expect(within(frris).getByText("Not enabled for your organization")).toBeInTheDocument();
  });
});

describe("FRRIS shell", () => {
  it("has a labelled main navigation with the FRRIS pages and the account", async () => {
    renderAt("/frris/analyses");
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const [name, href] of [["Analyses", "/frris/analyses"], ["New analysis", "/analyses"], ["Data catalog", "/data"], ["Exports", "/exports"]]) {
      expect(within(nav).getByRole("link", { name: new RegExp(`^${name}`) })).toHaveAttribute("href", href);
    }
    expect(within(nav).getByRole("link", { name: /^Analyses/ })).toHaveAttribute("aria-current", "page");
    expect(await within(nav).findByLabelText("2 running")).toBeInTheDocument();
    expect(screen.getByText("Session User")).toBeInTheDocument();
    expect(screen.getByText("Org One · Analyst")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("page content");
  });

  it("switcher lists FRRIS as current and WRRIS/MEGIS as in development, not clickable", () => {
    renderAt("/frris/analyses");
    const trigger = screen.getByRole("button", { name: /Switch system\. Current system: FRRIS/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Systems" });
    expect(within(list).getAllByRole("link")).toHaveLength(1);
    expect(within(list).getByRole("link", { name: /FRRIS/ })).toHaveAttribute("href", "/frris");
    for (const name of ["WRRIS", "MEGIS"]) {
      const item = within(list).getByText(name).closest("li")!;
      expect(within(item).getByText("In development")).toBeInTheDocument();
      expect(within(item).queryByRole("link")).toBeNull();
      expect(within(item).queryByRole("button")).toBeNull();
    }
    expect(screen.getByRole("link", { name: "All systems" })).toHaveAttribute("href", "/");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("keeps every existing workspace page reachable and shows Administration only to admins and owners", () => {
    renderAt("/frris/analyses");
    const toggle = screen.getByRole("button", { name: "Workspace" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const name of ["Overview", "Projects", "AOIs", "Results", "Maps", "Reports", "External data", "Settings"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "Administration" })).toBeNull();
  });

  it("shows Administration to admins and the organization picker only with several memberships", () => {
    state.role = "admin";
    state.memberships = 2;
    renderAt("/settings");
    // On desktop the Workspace group is open when one of its pages is current.
    expect(screen.getByRole("button", { name: "Workspace" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/administration");
    expect(screen.getByRole("combobox", { name: "Organization" })).toBeInTheDocument();
  });
});
