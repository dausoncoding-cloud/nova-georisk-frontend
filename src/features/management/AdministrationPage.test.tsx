import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdministrationPage } from "./AdministrationPage";
import * as api from "./managementApi";
const state = vi.hoisted(() => ({ role: "admin" }));
vi.mock("../organization/OrganizationContext", () => ({ useOrganizationContext: () => ({ current_role: state.role, current_organization: { id: "org", name: "Example" }, user: { id: "self" } }) }));
vi.mock("./managementApi", async load => ({ ...await load<typeof import("./managementApi")>(), members: vi.fn(), changeMember: vi.fn(), auditLog: vi.fn(), invitations: vi.fn() }));
const member = (user_id: string, role: api.Member["role"]): api.Member => ({ user_id, role, organization_id: "org", display_name: user_id, email: `${user_id}@example.test`, issuer: "https://issuer.test/", subject: user_id, status: "active", user_active: true, updated_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" });
function setup() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter><AdministrationPage /></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { state.role = "admin"; vi.mocked(api.members).mockResolvedValue({ total: 3, items: [member("viewer-user", "viewer"), member("owner-user", "owner"), member("self", "admin")] }); vi.mocked(api.changeMember).mockClear(); });
describe("Administration protection", () => {
  it.each(["viewer", "analyst"])("blocks %s before mounting privileged queries", role => { state.role = role; vi.mocked(api.members).mockClear(); setup(); expect(screen.getByRole("alert")).toHaveTextContent("admin or owner"); expect(api.members).not.toHaveBeenCalled(); });
  it("limits admin role choices, blocks self/owner controls and requires explicit confirmation", async () => {
    vi.mocked(api.changeMember).mockResolvedValue(member("viewer-user", "analyst")); setup();
    const buttons = await screen.findAllByRole("button", { name: "Change access" });
    expect(buttons[1]).toBeDisabled(); expect(buttons[2]).toBeDisabled(); fireEvent.click(buttons[0]!);
    expect(screen.getByLabelText("Membership role").querySelectorAll("option")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Confirm change" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Membership role"), { target: { value: "analyst" } });
    fireEvent.click(screen.getByLabelText("I confirm this organization-scoped change.")); fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
    await waitFor(() => expect(api.changeMember).toHaveBeenCalledWith("org", "viewer-user", { role: "analyst", status: "active" }));
  });
  it("offers privileged roles only to owners and keeps server errors visible", async () => {
    state.role = "owner"; vi.mocked(api.changeMember).mockRejectedValue(new Error("The final active owner cannot be removed.")); setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "Change access" }))[1]!); expect(screen.getByLabelText("Membership role").querySelectorAll("option")).toHaveLength(4);
    fireEvent.click(screen.getByLabelText("I confirm this organization-scoped change.")); fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("final active owner"); expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
