import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisSubmitPage } from "./AnalysisSubmitPage";

const { submitAnalysisMock, preflightAnalysisMock } = vi.hoisted(() => ({ submitAnalysisMock: vi.fn(), preflightAnalysisMock: vi.fn() }));

const period = (start: string, end: string, extra: Record<string, unknown> = {}) => ({ start, end, sentinel1_pass_dates: [start], relative_orbits: [57], sentinel2_compliant_scenes: 1, nearest_pass_before: null, nearest_pass_after: null, ...extra });
const capacity = { scale_m: 30, bbox_pixels: 112225, estimated_request_bytes: 10436925, limit_bytes: 50331648, ratio: 0.207, suggested_scale_m: null };
const okResult = { ok: true, target: period("2024-05-24", "2024-05-26"), baseline: period("2022-08-28", "2022-09-03"), shared_relative_orbits: [57], capacity, blocking: [], warnings: [] };

vi.mock("../projects/projectsApi", () => ({ fetchProject: vi.fn().mockResolvedValue({ id: "project-1", name: "Lower Basin", description: "Flood study", organization_id: "org-1", engine_key: "firris", analysis_module: "flood_mapping", crs: "EPSG:4326", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }) }));
vi.mock("../aois/aoisApi", () => ({ fetchProjectAois: vi.fn().mockResolvedValue({ total: 1, limit: 200, offset: 0, items: [{ id: "aoi-1", project_id: "project-1", name: "Floodplain", source_type: "geojson", crs: "EPSG:4326", geometry: { type: "Polygon", coordinates: [[[36, -1], [37, -1], [37, 0], [36, -1]]] }, stats: { area_km2: 42, perimeter_m: 1000 }, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }] }) }));
vi.mock("../engines/engineQueries", () => ({ useAvailableEngines: () => ({ data: [{ key: "firris", name: "FRRIS", version: "1.0", access: true }], isPending: false, isError: false }), useEngineContract: () => ({ data: { engine_name: "FRRIS", engine_version: "1.0", products: [{ key: "flood_extent", label: "Flood-candidate extent (model-classified)", available_delivery_types: ["cog", "vector"], planned_delivery_types: [] }, { key: "flood_probability", label: "Model confidence score (Random Forest vote fraction)", available_delivery_types: ["cog"], planned_delivery_types: [] }] }, isPending: false, isError: false }) }));
vi.mock("./analysisApi", () => ({ submitAnalysis: submitAnalysisMock, preflightAnalysis: preflightAnalysisMock }));

describe("FRRIS analysis builder", () => {
  beforeEach(() => {
    submitAnalysisMock.mockReset();
    submitAnalysisMock.mockResolvedValue({ task: { task_id: "task-1" } });
    preflightAnalysisMock.mockReset();
    preflightAnalysisMock.mockResolvedValue(okResult);
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
    fireEvent.click(screen.getByRole("checkbox", { name: /Flood-candidate extent/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Validation and output")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Review and submit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit FRRIS analysis" }));

    await waitFor(() => expect(submitAnalysisMock).toHaveBeenCalledOnce());
    const payload = submitAnalysisMock.mock.calls[0]?.[0];
    expect(payload.parameters).not.toHaveProperty("preprocessing");
    expect(payload.parameters.workflow.preprocessing).toEqual({
      cloud_mask: true,
      preview_enhancement: false,
      sar_speckle_filter: true,
      sar_speckle_radius_m: 50,
      normalize_projection: true,
      clip_to_aoi: true,
    });
    expect(payload.parameters.workflow.sampling).toMatchObject({ sample_size: 5000, train_fraction: 0.7 });
    expect(payload.products).toEqual(["flood_extent"]);
  });
});

it("validates date fields at the period step and exposes keyboard step navigation", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/project-1/analysis"]}><Routes><Route path="/projects/:projectId/analysis" element={<AnalysisSubmitPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByText("Confirm project context");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const dates = screen.getAllByLabelText("Start");
  fireEvent.change(dates[0]!, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter both date ranges");
  expect(screen.getByRole("button", { name: /Context/ })).not.toBeDisabled();
  expect(screen.getByRole("button", { name: /Review/ })).toBeDisabled();
});

it("names the classifier score from the engine contract, never as a flood probability", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/project-1/analysis"]}><Routes><Route path="/projects/:projectId/analysis" element={<AnalysisSubmitPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByText("Confirm project context");
  for (let step = 0; step < 6; step += 1) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Model confidence score \(Random Forest vote fraction\)/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Review and submit")).toBeInTheDocument();
  const products = screen.getByText("Products", { selector: ".review-facts dt" }).nextElementSibling;
  expect(products).toHaveTextContent("Model confidence score (Random Forest vote fraction)");
  expect(document.body).not.toHaveTextContent(/flood probability/i);
});


describe("satellite availability on the analysis-period step (plan 4.1/4.4)", () => {
  const renderAt = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/project-1/analysis"]}><Routes><Route path="/projects/:projectId/analysis" element={<AnalysisSubmitPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    await screen.findByText("Confirm project context");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Analysis period")).toBeInTheDocument();
  };
  beforeEach(() => { submitAnalysisMock.mockReset(); preflightAnalysisMock.mockReset(); submitAnalysisMock.mockResolvedValue({ task: { task_id: "task-1" } }); });

  it("bounds the date inputs to the Sentinel-1 archive and today", async () => {
    preflightAnalysisMock.mockResolvedValue(okResult);
    await renderAt();
    const inputs = [...document.querySelectorAll('input[type="date"]')];
    expect(inputs).toHaveLength(4);
    for (const input of inputs) {
      expect(input).toHaveAttribute("min", "2014-10-03");
      expect(input).toHaveAttribute("max", new Date().toISOString().slice(0, 10));
    }
  });

  it("shows passes and the ready state when nothing blocks", async () => {
    preflightAnalysisMock.mockResolvedValue(okResult);
    await renderAt();
    expect(await screen.findByText(/Ready: Sentinel-1 orbit 57 in both windows/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.queryByText("Resolve the blocked items above to continue")).toBeNull();
    expect(screen.getByText(/Sentinel-1 pass 2024-05-24 · orbit 57/)).toBeInTheDocument();
    expect(preflightAnalysisMock.mock.calls[0]?.[0].parameters.workflow.source.provider).toBe("gee");
  });

  it("shows a Sentinel-2 warning without blocking submission", async () => {
    preflightAnalysisMock.mockResolvedValue({ ...okResult, target: period("2024-04-18", "2024-04-20", { sentinel2_compliant_scenes: 0 }),
      warnings: [{ code: "no_compliant_sentinel2", period: "target", message: "No Sentinel-2 scene with cloud ≤ 20% and degraded MSI ≤ 0.1% in the target window: the analysis can run, but its independent accuracy will not be assessable." }] });
    await renderAt();
    const warning = await screen.findByRole("note", { name: "Warnings" });
    expect(warning).toHaveTextContent("independent accuracy will not be assessable");
    expect(screen.queryByRole("alert", { name: "Blocking reasons" })).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("blocks submission, explains why, and offers the nearest pass", async () => {
    const blocked = { ...okResult, ok: false, target: period("2024-05-21", "2024-05-23", { sentinel1_pass_dates: [], relative_orbits: [], nearest_pass_before: "2024-05-13", nearest_pass_after: "2024-05-25" }), shared_relative_orbits: [],
      blocking: [{ code: "no_sentinel1_pass", period: "target", message: "No Sentinel-1 pass over this area between 2024-05-21 and 2024-05-23 (end date exclusive). Nearest usable passes: before 2024-05-13, after 2024-05-25." }] };
    preflightAnalysisMock.mockImplementation(async (body) => body.parameters.workflow.source.target_period.end === "2024-05-26" ? { ...okResult, target: period("2024-05-21", "2024-05-26") } : blocked);
    await renderAt();
    const alert = await screen.findByRole("alert", { name: "Blocking reasons" });
    expect(alert).toHaveTextContent("No Sentinel-1 pass over this area between 2024-05-21 and 2024-05-23");
    // Continue is truly disabled while the period is blocked, with a hint.
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByText("Resolve the blocked items above to continue")).toBeInTheDocument();
    // The nearest-pass action extends the target window to include 2024-05-25 (closer to the end than 2024-05-13 is to the start).
    fireEvent.click(screen.getByRole("button", { name: "Use nearest pass (2024-05-25)" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    expect(screen.queryByText("Resolve the blocked items above to continue")).toBeNull();
    for (let step = 2; step < 6; step += 1) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Flood-candidate extent/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit FRRIS analysis" })).toBeEnabled());
    expect(screen.getByText("2024-05-21 → 2024-05-26", { selector: ".review-facts dd" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit FRRIS analysis" }));
    await waitFor(() => expect(submitAnalysisMock).toHaveBeenCalledOnce());
    expect(submitAnalysisMock.mock.calls[0]?.[0].parameters.workflow.source.target_period).toEqual({ start: "2024-05-21", end: "2024-05-26" });
  });
});


describe("nearest pass that loses the compliant Sentinel-2 scene (r3.1)", () => {
  it("re-runs the check and shows the Sentinel-2 warning next to Continue", async () => {
    const blocked = { ...okResult, ok: false, target: period("2024-05-26", "2024-05-27", { sentinel1_pass_dates: [], relative_orbits: [], nearest_pass_before: "2024-05-25", nearest_pass_after: "2024-06-06" }), shared_relative_orbits: [],
      blocking: [{ code: "no_sentinel1_pass", period: "target", message: "No Sentinel-1 pass over this area between 2024-05-26 and 2024-05-27 (end date exclusive). Nearest usable passes: before 2024-05-25, after 2024-06-06." }] };
    const extendedNoOptical = { ...okResult, target: period("2024-05-25", "2024-05-27", { sentinel2_compliant_scenes: 0 }),
      warnings: [{ code: "no_compliant_sentinel2", period: "target", message: "No Sentinel-2 scene with cloud ≤ 20% and degraded MSI ≤ 0.1% in the target window: the analysis can run, but its independent accuracy will not be assessable." }] };
    submitAnalysisMock.mockReset(); preflightAnalysisMock.mockReset();
    preflightAnalysisMock.mockImplementation(async (body) => body.parameters.workflow.source.target_period.start === "2024-05-25" ? extendedNoOptical : blocked);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/project-1/analysis"]}><Routes><Route path="/projects/:projectId/analysis" element={<AnalysisSubmitPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    await screen.findByText("Confirm project context");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use nearest pass (2024-05-25)" }));
    await waitFor(() => expect(preflightAnalysisMock.mock.calls.at(-1)?.[0].parameters.workflow.source.target_period).toEqual({ start: "2024-05-25", end: "2024-05-27" }));
    expect(await screen.findByRole("note", { name: "Warnings" })).toHaveTextContent("independent accuracy will not be assessable");
    const footerHint = screen.getByRole("status", { name: "Before you continue" });
    expect(footerHint).toHaveTextContent("Independent accuracy will not be assessable for this window");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
