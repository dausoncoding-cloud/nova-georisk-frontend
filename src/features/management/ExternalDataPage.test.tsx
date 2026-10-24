import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalDataPage } from "./ExternalDataPage";
import * as api from "./managementApi";
const state = vi.hoisted(() => ({ role: "analyst" }));
vi.mock("../organization/OrganizationContext", () => ({ useOrganizationContext: () => ({ current_role: state.role, current_organization: { id: "org", name: "Example" }, user: { id: "self" } }) }));
vi.mock("../projects/projectsApi", () => ({ fetchProjects: vi.fn().mockResolvedValue([{ id: "p", name: "Example project" }]) }));
vi.mock("../aois/aoisApi", () => ({ fetchProjectAois: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock("./managementApi", async load => ({ ...await load<typeof import("./managementApi")>(), catalogue: vi.fn(), datasets: vi.fn(), uploadDataset: vi.fn(), validateDataset: vi.fn(), eligibility: vi.fn(), usage: vi.fn(), reviewDataset: vi.fn(), bindingContract: vi.fn().mockResolvedValue({}), validateBindings: vi.fn() }));
const dataset: api.ManagedDataset = { id: "d", series_id: "s", version: 1, project_id: "p", aoi_id: null, uploader_id: "self", source_dataset_id: null, title: "Gauge source", category: "rainfall_stations", format: "csv", status: "Uploaded", sha256: "a".repeat(64), size_bytes: 80, metadata: {}, validation: {}, created_at: "2026-01-01T00:00:00Z" };
function setup() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter><ExternalDataPage /></MemoryRouter></QueryClientProvider>); }
async function project() { await screen.findByRole("option", { name: "Example project" }); fireEvent.change(await screen.findByLabelText("Project"), { target: { value: "p" } }); await screen.findByRole("tab", { name: "Upload" }); }
beforeEach(() => { state.role = "analyst"; vi.mocked(api.catalogue).mockResolvedValue({ profiles: { rainfall_stations: { format: "csv", unit: "mm" } } }); vi.mocked(api.datasets).mockResolvedValue({ total: 1, items: [dataset] }); vi.mocked(api.uploadDataset).mockResolvedValue(dataset); vi.mocked(api.uploadDataset).mockClear(); vi.mocked(api.reviewDataset).mockClear(); vi.mocked(api.eligibility).mockResolvedValue({ dataset_id: "d", approved: false, compatible: false, reasons: ["Scientific approval is required."], candidate_modules: ["hazard"], note: "Candidate input only." }); vi.mocked(api.usage).mockResolvedValue({ tasks: [] }); });
describe("External dataset lifecycle UI", () => {
  it("requires review before storing a private upload and never auto-approves", async () => {
    setup(); await project(); fireEvent.click(screen.getByRole("tab", { name: "Upload" }));
    fireEvent.change(screen.getByLabelText("Dataset title"), { target: { value: "Gauge source" } }); fireEvent.change(screen.getByLabelText("Dataset type"), { target: { value: "rainfall_stations" } });
    const file = new File(["station,value\ns1,2\n"], "gauges.csv", { type: "text/csv" }); fireEvent.change(screen.getByLabelText(/Source file/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Review upload" })); expect(api.uploadDataset).not.toHaveBeenCalled(); expect(screen.getByText("Private to this organization/project")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Store private dataset" })); await waitFor(() => expect(api.uploadDataset).toHaveBeenCalled());
    expect(await screen.findByText("Uploaded", { selector: ".count-badge" })).toBeInTheDocument(); expect(api.reviewDataset).not.toHaveBeenCalled();
  });
  it("allows viewer inspection but blocks upload controls", async () => { state.role = "viewer"; setup(); await project(); fireEvent.click(screen.getByRole("tab", { name: "Upload" })); expect(screen.getByRole("alert")).toHaveTextContent("permissions"); expect(screen.queryByRole("button", { name: "Store private dataset" })).not.toBeInTheDocument(); });
  it("does not offer an unapproved source as an analysis input", async () => { setup(); await project(); fireEvent.click(await screen.findByRole("button", { name: "Inspect version" })); fireEvent.click(screen.getByRole("tab", { name: "Usage" })); expect(await screen.findByText("Not ready for this analysis")).toBeInTheDocument(); expect(screen.queryByLabelText("Approved source identifier for explicit analysis bindings")).not.toBeInTheDocument(); expect(screen.getByLabelText("Approved version for analysis compatibility").querySelectorAll("option")).toHaveLength(1); });
});
