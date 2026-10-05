import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisSubmitPage } from "./AnalysisSubmitPage";

const { submitAnalysisMock } = vi.hoisted(() => ({ submitAnalysisMock: vi.fn() }));

vi.mock("../projects/projectsApi", () => ({ fetchProject: vi.fn().mockResolvedValue({ id: "project-1", name: "Lower Basin", description: "Flood study", organization_id: "org-1", engine_key: "firris", analysis_module: "flood_mapping", crs: "EPSG:4326", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }) }));
vi.mock("../aois/aoisApi", () => ({ fetchProjectAois: vi.fn().mockResolvedValue({ total: 1, limit: 200, offset: 0, items: [{ id: "aoi-1", project_id: "project-1", name: "Floodplain", source_type: "geojson", crs: "EPSG:4326", geometry: { type: "Polygon", coordinates: [[[36, -1], [37, -1], [37, 0], [36, -1]]] }, stats: { area_km2: 42, perimeter_m: 1000 }, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }] }) }));
vi.mock("../engines/engineQueries", () => ({ useAvailableEngines: () => ({ data: [{ key: "firris", name: "FIRRIS", version: "1.0", access: true }], isPending: false, isError: false }), useEngineContract: () => ({ data: { engine_name: "FIRRIS", engine_version: "1.0", products: [{ key: "flood_extent", label: "Flood Extent", available_delivery_types: ["cog", "vector"], planned_delivery_types: [] }] }, isPending: false, isError: false }) }));
vi.mock("./analysisApi", () => ({ submitAnalysis: submitAnalysisMock }));

describe("FIRRIS analysis builder", () => {
  beforeEach(() => {
    submitAnalysisMock.mockReset();
    submitAnalysisMock.mockResolvedValue({ task: { task_id: "task-1" } });
  });

  it("uses guided stages without a raw JSON form", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/project-1/analysis"]}><Routes><Route path="/projects/:projectId/analysis" element={<AnalysisSubmitPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Confirm project context")).toBeInTheDocument();
    expect(screen.queryByText(/Analysis parameters/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Select area of interest")).toBeInTheDocument();
    expect(screen.getAllByText("Floodplain").length).toBeGreaterThan(0);
  });

  it("traverses all default steps and submits a valid nested preprocessing payload", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/project-1/analysis"]}><Routes><Route path="/projects/:projectId/analysis" element={<AnalysisSubmitPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Confirm project context")).toBeInTheDocument();

    for (let step = 0; step < 6; step += 1) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Select products")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Flood Extent/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Validation and output")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Review and submit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit FIRRIS analysis" }));

    await waitFor(() => expect(submitAnalysisMock).toHaveBeenCalledOnce());
    const payload = submitAnalysisMock.mock.calls[0]?.[0];
    expect(payload.parameters).not.toHaveProperty("preprocessing");
    expect(payload.parameters.workflow.preprocessing).toEqual({
      cloud_mask: true,
      sar_speckle_filter: true,
      sar_speckle_radius_m: 50,
      normalize_projection: true,
      clip_to_aoi: true,
    });
    expect(payload.parameters.workflow.sampling).toMatchObject({ sample_size: 5000, train_fraction: 0.7 });
    expect(payload.products).toEqual(["flood_extent"]);
  });
});
