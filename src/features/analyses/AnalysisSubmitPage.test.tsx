import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../shared/ui/Toast";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisSubmitPage, defaultBuilderForm, toApiForm } from "./AnalysisSubmitPage";
import { addDays, formatPeriod, periodProblem, todayIso } from "./periods";
import { ApiError, describeApiError } from "../../shared/api/errors";

const { submitAnalysisMock, preflightAnalysisMock, fetchProjectAoisMock } = vi.hoisted(() => ({ submitAnalysisMock: vi.fn(), preflightAnalysisMock: vi.fn(), fetchProjectAoisMock: vi.fn() }));

const period = (start: string, end: string, extra: Record<string, unknown> = {}) => ({ start, end, sentinel1_pass_dates: [start], relative_orbits: [57], sentinel2_compliant_scenes: 1, nearest_pass_before: null, nearest_pass_after: null, ...extra });
const capacity = { scale_m: 30, bbox_pixels: 112225, estimated_request_bytes: 10436925, limit_bytes: 50331648, ratio: 0.207, suggested_scale_m: null };
const okResult = { ok: true, target: period("2024-05-24", "2024-05-26"), baseline: period("2022-08-28", "2022-09-03"), shared_relative_orbits: [57], capacity, blocking: [], warnings: [] };
const project = (id: string, name: string, engine_key = "firris") => ({ id, name, description: null, organization_id: "org-1", engine_key, analysis_module: "FIRRIS", crs: "EPSG:4326", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
const aoi = (id: string, name: string, project_id = "project-1") => ({ id, project_id, name, source_type: "geojson", crs: "EPSG:4326", geometry: { type: "Polygon", coordinates: [[[36, -1], [37, -1], [37, 0], [36, -1]]] }, stats: { area_km2: 42, perimeter_m: 1000 }, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
const PROJECTS: Record<string, ReturnType<typeof project>> = { "project-1": project("project-1", "Lower Basin"), "project-2": project("project-2", "Upper Basin"), "project-x": project("project-x", "Wildfire pilot", "wras") };

vi.mock("../projects/projectsApi", () => ({
  fetchProject: vi.fn(async (id: string) => PROJECTS[id]),
  fetchProjects: vi.fn(async () => Object.values(PROJECTS)),
}));
vi.mock("../aois/aoisApi", async (load) => ({ ...await load<typeof import("../aois/aoisApi")>(), fetchProjectAois: fetchProjectAoisMock }));
vi.mock("../engines/engineQueries", () => ({ useAvailableEngines: () => ({ data: [{ key: "firris", name: "FRRIS", version: "1.0", access: true }], isPending: false, isError: false }), useEngineContract: () => ({ data: { engine_name: "FRRIS", engine_version: "1.0", products: [{ key: "flood_extent", label: "Flood-candidate extent (model-classified)", available_delivery_types: ["cog", "vector"], planned_delivery_types: [] }, { key: "flood_probability", label: "Model confidence score (Random Forest vote fraction)", available_delivery_types: ["cog"], planned_delivery_types: [] }, { key: "flood_depth", label: "Flood depth", available_delivery_types: [], planned_delivery_types: ["cog"] }] }, isPending: false, isError: false }) }));
vi.mock("./analysisApi", () => ({ submitAnalysis: submitAnalysisMock, preflightAnalysis: preflightAnalysisMock }));

function renderBuilder(path = "/projects/project-1/analyze") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/projects/:projectId/analyze" element={<AnalysisSubmitPage />} />
    <Route path="/projects/:projectId/analysis" element={<AnalysisSubmitPage embedded />} />
    <Route path="/frris/analyses/new" element={<AnalysisSubmitPage />} />
    <Route path="/tasks/:taskId" element={<p>task page</p>} />
  </Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
}

const dates = () => ({
  targetStart: screen.getAllByLabelText("First day")[0]!, targetLast: screen.getAllByLabelText("Last day (included)")[0]!,
  baselineStart: screen.getAllByLabelText("First day")[1]!, baselineLast: screen.getAllByLabelText("Last day (included)")[1]!,
});
const setDate = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const lastPreflight = () => preflightAnalysisMock.mock.calls.at(-1)?.[0];
const run = () => fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
// The flood-candidate extent is selected by default (r5.1); this only makes sure it is still selected.
const selectExtent = () => { const box = screen.getByRole("checkbox", { name: /Flood-candidate extent/i }); if (!(box as HTMLInputElement).checked) fireEvent.click(box); };

beforeEach(() => {
  submitAnalysisMock.mockReset().mockResolvedValue({ task: { task_id: "task-1" } });
  preflightAnalysisMock.mockReset().mockResolvedValue(okResult);
  fetchProjectAoisMock.mockReset().mockImplementation(async (projectId: string) => ({ total: 1, limit: 200, offset: 0, items: projectId === "project-2" ? [aoi("aoi-2", "Upper reach", "project-2")] : [aoi("aoi-1", "Floodplain")] }));
});

describe("inclusive end dates (backlog §4.7 item 1)", () => {
  it("adds one day to each last day before the API, and only there", () => {
    expect(defaultBuilderForm.targetLast).toBe("2025-03-31");
    expect(defaultBuilderForm.baselineLast).toBe("2024-03-31");
    const api = toApiForm({ ...defaultBuilderForm, targetStart: "2024-05-24", targetLast: "2024-05-25", baselineStart: "2024-12-31", baselineLast: "2024-12-31" });
    expect(api).toMatchObject({ targetStart: "2024-05-24", targetEnd: "2024-05-26", baselineStart: "2024-12-31", baselineEnd: "2025-01-01" });
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap year
  });

  it("validates the window in inclusive terms with the archive start and today (UTC) as limits", () => {
    const today = "2026-11-16";
    expect(periodProblem("Target", { start: "2024-05-24", lastDay: "2024-05-24" }, today)).toBeNull(); // one-day window
    expect(periodProblem("Target", { start: "2024-05-25", lastDay: "2024-05-24" }, today)).toMatch(/first day must be on or before the last day/);
    expect(periodProblem("Target", { start: "2014-10-03", lastDay: today }, today)).toBeNull(); // both limits are allowed
    expect(periodProblem("Target", { start: "2014-10-02", lastDay: "2014-10-10" }, today)).toMatch(/3 October 2014/);
    expect(periodProblem("Baseline", { start: "2026-11-10", lastDay: "2026-11-17" }, today)).toMatch(/cannot be after today \(2026-11-16, UTC\)/);
    expect(periodProblem("Target", { start: "", lastDay: "2024-05-24" }, today)).toMatch(/enter the first and the last day/);
  });

  it("formats inclusive periods like the design", () => {
    expect(formatPeriod({ start: "2024-05-24", lastDay: "2024-05-25" })).toBe("24–25 May 2024");
    expect(formatPeriod({ start: "2022-08-28", lastDay: "2022-09-02" })).toBe("28 Aug – 2 Sep 2022");
    expect(formatPeriod({ start: "2023-12-30", lastDay: "2024-01-02" })).toBe("30 Dec 2023 – 2 Jan 2024");
    expect(formatPeriod({ start: "2024-05-24", lastDay: "2024-05-24" })).toBe("24 May 2024");
  });

  it("labels the inputs as inclusive, says so in the help text and bounds them to 2014-10-03 … today (UTC)", async () => {
    renderBuilder();
    await screen.findByRole("heading", { name: /Periods and satellite availability/ });
    expect(screen.getAllByLabelText("Last day (included)")).toHaveLength(2);
    expect(screen.getByText(/End dates are inclusive/)).toBeInTheDocument();
    const inputs = [...document.querySelectorAll('input[type="date"]')];
    expect(inputs).toHaveLength(4);
    for (const input of inputs) {
      expect(input).toHaveAttribute("min", "2014-10-03");
      expect(input).toHaveAttribute("max", todayIso());
    }
  });

  it("sends last day + 1 to the preflight and to the submission", async () => {
    renderBuilder();
    await screen.findByText("Floodplain");
    const d = dates();
    setDate(d.targetStart, "2024-05-24"); setDate(d.targetLast, "2024-05-25");
    setDate(d.baselineStart, "2022-08-28"); setDate(d.baselineLast, "2022-09-02");
    await waitFor(() => expect(lastPreflight()?.parameters.workflow.source.target_period).toEqual({ start: "2024-05-24", end: "2024-05-26" }));
    expect(lastPreflight().parameters.workflow.source.baseline_period).toEqual({ start: "2022-08-28", end: "2022-09-03" });
    selectExtent(); run();
    await waitFor(() => expect(submitAnalysisMock).toHaveBeenCalledOnce());
    const payload = submitAnalysisMock.mock.calls[0]![0];
    expect(payload.parameters.workflow.source.target_period).toEqual({ start: "2024-05-24", end: "2024-05-26" });
    expect(payload.parameters.workflow.source.baseline_period).toEqual({ start: "2022-08-28", end: "2022-09-03" });
    expect(payload.gis_metadata.acquisition_date).toBe("2024-05-26"); // unchanged meaning: the API end of the target window
    expect(screen.getByText("task page")).toBeInTheDocument();
  });

  it("accepts today as the last day (API end = tomorrow) and refuses tomorrow without calling the API", async () => {
    const today = todayIso();
    renderBuilder();
    await screen.findByText("Floodplain");
    const d = dates();
    setDate(d.targetStart, addDays(today, -3)); setDate(d.targetLast, today);
    await waitFor(() => expect(lastPreflight()?.parameters.workflow.source.target_period).toEqual({ start: addDays(today, -3), end: addDays(today, 1) }));
    const calls = preflightAnalysisMock.mock.calls.length;
    setDate(d.targetLast, addDays(today, 1));
    expect(await screen.findByText(/Target: the last day cannot be after today/)).toBeInTheDocument();
    selectExtent(); run();
    expect(screen.getByRole("alert")).toHaveTextContent("Target: the last day cannot be after today");
    expect(preflightAnalysisMock.mock.calls.length).toBe(calls);
    expect(submitAnalysisMock).not.toHaveBeenCalled();
  });

  it("refuses a first day after the last day and dates before the Sentinel-1 archive", async () => {
    renderBuilder();
    await screen.findByText("Floodplain");
    const d = dates();
    setDate(d.baselineStart, "2024-04-02"); setDate(d.baselineLast, "2024-04-01");
    selectExtent(); run();
    expect(screen.getByRole("alert")).toHaveTextContent("Baseline: the first day must be on or before the last day.");
    setDate(d.baselineStart, "2014-10-01"); setDate(d.baselineLast, "2014-10-20");
    run();
    expect(screen.getByRole("alert")).toHaveTextContent("Baseline: Sentinel-1 data starts on 3 October 2014.");
    expect(submitAnalysisMock).not.toHaveBeenCalled();
  });
});

describe("FRRIS analysis builder", () => {
  it("shows the design's numbered steps without a raw JSON form", async () => {
    renderBuilder();
    expect(await screen.findByRole("heading", { level: 1, name: "New flood analysis" })).toBeInTheDocument();
    for (const name of ["Area of interest", "Periods and satellite availability", "Data quality", "Products", "Processing and sampling"]) {
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: /Floodplain/ })).toBeChecked();
    expect(screen.getByRole("complementary", { name: "Run summary" })).toBeInTheDocument();
    expect(screen.queryByText(/Analysis parameters/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\[[^\]]*\]/);
  });

  it("keeps every default and fixed parameter in the payload; only the end dates move by one day", async () => {
    renderBuilder();
    await screen.findByText("Floodplain");
    await waitFor(() => expect(preflightAnalysisMock).toHaveBeenCalled());
    selectExtent(); run();
    await waitFor(() => expect(submitAnalysisMock).toHaveBeenCalledOnce());
    const payload = submitAnalysisMock.mock.calls[0]![0];
    expect(payload).toMatchObject({ project_id: "project-1", aoi_id: "aoi-1", operation: "flood_mapping", products: ["flood_extent"] });
    expect(payload.parameters).not.toHaveProperty("preprocessing");
    expect(payload.parameters.workflow).toEqual({
      source: {
        provider: "gee", date_mode: "pre-post",
        datasets: ["COPERNICUS/S1_GRD", "COPERNICUS/S2_SR_HARMONIZED", "UCSB-CHG/CHIRPS/DAILY", "USGS/SRTMGL1_003", "JRC/GSW1_4/GlobalSurfaceWater"],
        target_period: { start: "2025-03-01", end: "2025-04-01" }, baseline_period: { start: "2024-03-01", end: "2024-04-01" },
        max_cloud_pct: 20, minimum_valid_coverage_pct: 70, scale: 30, target_crs: "EPSG:4326", dem_source: "SRTM",
        features: ["sar_vv_target", "sar_change", "elevation", "slope", "rainfall"],
      },
      preprocessing: { cloud_mask: true, preview_enhancement: false, sar_speckle_filter: true, sar_speckle_radius_m: 50, normalize_projection: true, clip_to_aoi: true },
      sampling: { strategy: "stratified_random", sample_size: 5000, min_per_class: 30, train_fraction: 0.7, random_seed: 12345 },
      model: { algorithm: "random_forest", version: "1.0", n_estimators: 200 },
      quality: {},
    });
    expect(payload.gis_metadata).toMatchObject({ crs: "EPSG:4326", spatial_resolution: { x: 30, y: 30, unit: "m" }, acquisition_date: "2025-04-01", producer: "NOVA GeoRisk", engine_version: "1.0" });
    // The preflight uses the same request shape.
    expect(preflightAnalysisMock.mock.calls[0]![0].parameters).toEqual(payload.parameters);
  });

  it("keeps the existing validations", async () => {
    renderBuilder();
    await screen.findByText("Floodplain");
    fireEvent.click(screen.getByRole("checkbox", { name: /Flood-candidate extent/i })); // deselect the default
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeDisabled();
    selectExtent();
    fireEvent.change(screen.getByLabelText(/Max\. cloud cover \(Sentinel-2\)/), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Sample size"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Output scale/), { target: { value: "0" } });
    run();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Cloud cover must be between 0 and 100 percent.");
    expect(alert).toHaveTextContent("Enter a whole sample size between 10 and 1,000,000 and a training fraction between 0.5 and 0.99.");
    expect(alert).toHaveTextContent("Output scale must be between 1 and 1,000 metres.");
    // A product whose module is not approved is listed as "Coming soon", with no checkbox.
    expect(screen.queryByRole("checkbox", { name: /Flood depth/ })).toBeNull();
    expect(screen.getByText("Flood depth").nextElementSibling).toHaveTextContent("Coming soon");
    expect(submitAnalysisMock).not.toHaveBeenCalled();
  });

  it("names the classifier score from the engine contract, never as a flood probability", async () => {
    renderBuilder();
    await screen.findByText("Floodplain");
    fireEvent.click(screen.getByRole("checkbox", { name: /Model confidence score \(Random Forest vote fraction\)/ }));
    const summary = screen.getByRole("complementary", { name: "Run summary" });
    expect(within(summary).getByText("Products").nextElementSibling).toHaveTextContent("Model confidence score (Random Forest vote fraction)");
    expect(document.body).not.toHaveTextContent(/flood probability/i);
  });

  it("summarises the run with inclusive dates and the radar orbit", async () => {
    renderBuilder();
    await screen.findByText("Floodplain");
    const d = dates();
    setDate(d.targetStart, "2024-05-24"); setDate(d.targetLast, "2024-05-25");
    setDate(d.baselineStart, "2022-08-28"); setDate(d.baselineLast, "2022-09-02");
    const summary = screen.getByRole("complementary", { name: "Run summary" });
    expect(within(summary).getByText("Target").nextElementSibling).toHaveTextContent("24–25 May 2024");
    expect(within(summary).getByText("Baseline").nextElementSibling).toHaveTextContent("28 Aug – 2 Sep 2022");
    expect(within(summary).getByText("Quality").nextElementSibling).toHaveTextContent("Cloud ≤ 20% · cover ≥ 70% · MSI ≤ 0.1%");
    await waitFor(() => expect(within(summary).getByText("Radar").nextElementSibling).toHaveTextContent("Sentinel-1 VV · orbit 57"));
    expect(within(summary).getByRole("img", { name: "Download size estimate: 10.0 of 48 MiB limit" })).toBeInTheDocument();
  });

  it("lets the user choose an FRRIS project when opened from FRRIS, and loads that project's areas", async () => {
    renderBuilder("/frris/analyses/new");
    const select = await screen.findByRole("combobox", { name: "Project" });
    expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Lower Basin", "Upper Basin"]);
    expect(await screen.findByRole("radio", { name: /Floodplain/ })).toBeChecked();
    fireEvent.change(select, { target: { value: "project-2" } });
    expect(await screen.findByRole("radio", { name: /Upper reach/ })).toBeChecked();
    expect(screen.getByRole("link", { name: "← Analyses" })).toHaveAttribute("href", "/frris/analyses");
  });

  it("takes the resolution chosen in the area playground (?scale=60) and keeps 30 m otherwise", async () => {
    renderBuilder("/frris/analyses/new?project=project-1&aoi_id=aoi-1&scale=60");
    expect(await screen.findByLabelText(/Output scale/)).toHaveValue(60);
    await waitFor(() => expect(lastPreflight()?.parameters.workflow.source.scale).toBe(60));
  });

  it("uses a level-2 heading inside the project workspace and opens the area wizard", async () => {
    renderBuilder("/projects/project-1/analysis");
    expect(await screen.findByRole("heading", { level: 2, name: "New flood analysis" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Draw or upload an area" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("satellite availability (plan 4.1/4.4)", () => {
  it("ready: green box, passes, download size in MiB, Run enabled", async () => {
    renderBuilder();
    const ready = await screen.findByText(/Ready: Sentinel-1 orbit 57 in both windows/);
    expect(ready.closest(".fr-box")).toHaveClass("fr-box--success");
    expect(ready.closest("[role=status]")).not.toBeNull();
    expect(screen.getByText("Sentinel-1 pass 2024-05-24 · orbit 57")).toBeInTheDocument();
    const availability = screen.getByRole("region", { name: "Satellite availability" });
    expect(availability).toHaveTextContent("10.0 of 48 MiB");
    expect(availability).toHaveTextContent("at 30 m");
    expect(document.body.textContent).not.toMatch(/\bMB\b/);
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeEnabled();
    expect(screen.queryByText("Resolve the blocked dates above to continue.")).toBeNull();
    expect(lastPreflight().parameters.workflow.source.provider).toBe("gee");
  });

  it("warning: shows the Sentinel-2 tiles and area coverage and names the window next to Run", async () => {
    preflightAnalysisMock.mockResolvedValue({ ...okResult,
      target: period("2024-05-01", "2024-06-01", { sentinel2_compliant_scenes: 3, sentinel2_tiles: ["36LZR", "37MBM"], sentinel2_dates: ["2024-05-02", "2024-05-17"], sentinel2_aoi_coverage_pct: 88, sentinel2_summary: "3 granules on 2 dates (2 tiles)" }),
      warnings: [{ code: "sentinel2_partial_coverage", period: "target", message: "The compliant Sentinel-2 scenes in the target window cover only 88% of the area: 3 granules on 2 dates (2 tiles: 36LZR, 37MBM). The analysis can run, but its independent accuracy will not be assessable: the reference must cover the whole area. Widen the window to include a clear date over every tile, or continue." }] });
    renderBuilder();
    expect(await screen.findByText("Sentinel-2 3 granules on 2 dates (2 tiles: 36LZR, 37MBM), 88% of the area")).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Warnings" })).toHaveTextContent("cover only 88% of the area");
    expect(screen.getByRole("status", { name: "Before you continue" })).toHaveTextContent("Independent accuracy not assessable for the target window (see the warning above).");
    expect(screen.queryByRole("alert", { name: "Blocking reasons" })).toBeNull();
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeEnabled();
  });

  it("warning for both windows names both", async () => {
    const none = { code: "no_compliant_sentinel2", message: "No Sentinel-2 scene … independent accuracy will not be assessable." };
    preflightAnalysisMock.mockResolvedValue({ ...okResult, warnings: [{ ...none, period: "target" }, { ...none, period: "baseline" }] });
    renderBuilder();
    expect(await screen.findByRole("status", { name: "Before you continue" })).toHaveTextContent("Independent accuracy not assessable for both windows (see the warning above).");
  });

  it("blocked: red box, Run disabled with the hint, and 'Use nearest pass' extends the window", async () => {
    // UI window 21–22 May (API end 23 May) has no pass.
    const blocked = { ...okResult, ok: false, target: period("2024-05-21", "2024-05-23", { sentinel1_pass_dates: [], relative_orbits: [], nearest_pass_before: "2024-05-13", nearest_pass_after: "2024-05-25" }), shared_relative_orbits: [],
      blocking: [{ code: "no_sentinel1_pass", period: "target", message: "No Sentinel-1 pass over this area between 2024-05-21 and 2024-05-23 (end date exclusive). Nearest usable passes: before 2024-05-13, after 2024-05-25." }] };
    preflightAnalysisMock.mockImplementation(async (body) => body.parameters.workflow.source.target_period.end === "2024-05-26" ? { ...okResult, target: period("2024-05-21", "2024-05-26") } : blocked);
    renderBuilder();
    await screen.findByText("Floodplain");
    const d = dates();
    setDate(d.targetStart, "2024-05-21"); setDate(d.targetLast, "2024-05-22");
    const alert = await screen.findByRole("alert", { name: "Blocking reasons" });
    expect(alert).toHaveClass("fr-box--danger");
    expect(alert).toHaveTextContent("Cannot run with these dates");
    expect(alert).toHaveTextContent("No Sentinel-1 pass over this area between 2024-05-21 and 2024-05-23");
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeDisabled();
    expect(screen.getByText("Resolve the blocked dates above to continue.")).toBeInTheDocument();
    // 2024-05-25 is closer to the end than 2024-05-13 is to the start: the window grows to include it.
    fireEvent.click(within(alert).getByRole("button", { name: "Use nearest pass (25 May 2024)" }));
    expect(dates().targetStart).toHaveValue("2024-05-21");
    expect(dates().targetLast).toHaveValue("2024-05-25");
    await waitFor(() => expect(screen.getByRole("button", { name: "Run analysis" })).toBeEnabled());
    expect(lastPreflight().parameters.workflow.source.target_period).toEqual({ start: "2024-05-21", end: "2024-05-26" });
    expect(screen.queryByText("Resolve the blocked dates above to continue.")).toBeNull();
    selectExtent(); run();
    await waitFor(() => expect(submitAnalysisMock).toHaveBeenCalledOnce());
    expect(submitAnalysisMock.mock.calls[0]![0].parameters.workflow.source.target_period).toEqual({ start: "2024-05-21", end: "2024-05-26" });
  });

  it("re-checks after a nearest pass that loses the compliant Sentinel-2 scene (r3.1)", async () => {
    const blocked = { ...okResult, ok: false, target: period("2024-05-26", "2024-05-27", { sentinel1_pass_dates: [], relative_orbits: [], nearest_pass_before: "2024-05-25", nearest_pass_after: "2024-06-06" }), shared_relative_orbits: [],
      blocking: [{ code: "no_sentinel1_pass", period: "target", message: "No Sentinel-1 pass over this area between 2024-05-26 and 2024-05-27 (end date exclusive). Nearest usable passes: before 2024-05-25, after 2024-06-06." }] };
    const extendedNoOptical = { ...okResult, target: period("2024-05-25", "2024-05-27", { sentinel2_compliant_scenes: 0 }),
      warnings: [{ code: "no_compliant_sentinel2", period: "target", message: "No Sentinel-2 scene with cloud ≤ 20% and degraded MSI ≤ 0.1% in the target window: the analysis can run, but its independent accuracy will not be assessable." }] };
    preflightAnalysisMock.mockImplementation(async (body) => body.parameters.workflow.source.target_period.start === "2024-05-25" ? extendedNoOptical : blocked);
    renderBuilder();
    await screen.findByText("Floodplain");
    setDate(dates().targetStart, "2024-05-26"); setDate(dates().targetLast, "2024-05-26");
    fireEvent.click(await screen.findByRole("button", { name: "Use nearest pass (25 May 2024)" }));
    await waitFor(() => expect(lastPreflight().parameters.workflow.source.target_period).toEqual({ start: "2024-05-25", end: "2024-05-27" }));
    expect(dates().targetLast).toHaveValue("2024-05-26");
    expect(await screen.findByRole("note", { name: "Warnings" })).toHaveTextContent("independent accuracy will not be assessable");
    expect(screen.getByRole("status", { name: "Before you continue" })).toHaveTextContent("Independent accuracy not assessable for the target window");
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeEnabled();
  });

  it("shows server errors from the submission", async () => {
    submitAnalysisMock.mockRejectedValue(new Error("The AOI is outside the organization's scope."));
    renderBuilder();
    await screen.findByText("Floodplain");
    selectExtent(); run();
    expect(await screen.findByRole("alert")).toHaveTextContent("The AOI is outside the organization's scope.");
  });
});


describe("products (r5.1)", () => {
  const extent = () => screen.getByRole("checkbox", { name: /Flood-candidate extent/i }) as HTMLInputElement;

  it("selects the flood-candidate extent on load and keeps it through AOI, project and date changes", async () => {
    fetchProjectAoisMock.mockImplementation(async (projectId: string) => ({ total: 2, limit: 200, offset: 0, items: projectId === "project-2"
      ? [aoi("aoi-2", "Upper reach", "project-2")] : [aoi("aoi-1", "Floodplain"), aoi("aoi-3", "Delta")] }));
    renderBuilder("/frris/analyses/new");
    await screen.findByRole("radio", { name: /Floodplain/ });
    expect(extent()).toBeChecked();
    const summary = () => within(screen.getByRole("complementary", { name: "Run summary" })).getByText("Products").nextElementSibling;
    expect(summary()).toHaveTextContent("Flood-candidate extent (model-classified)");
    fireEvent.click(screen.getByRole("radio", { name: /Delta/ }));
    setDate(dates().targetStart, "2024-05-24"); setDate(dates().targetLast, "2024-05-25");
    fireEvent.change(screen.getByRole("combobox", { name: "Project" }), { target: { value: "project-2" } });
    await screen.findByRole("radio", { name: /Upper reach/ });
    expect(extent()).toBeChecked();
    expect(summary()).toHaveTextContent("Flood-candidate extent (model-classified)");
    await waitFor(() => expect(lastPreflight()?.products).toEqual(["flood_extent"]));
  });

  it("without a product: no preflight call, a specific message next to the check and Run, and Run disabled", async () => {
    renderBuilder();
    await waitFor(() => expect(preflightAnalysisMock).toHaveBeenCalled());
    const calls = preflightAnalysisMock.mock.calls.length;
    fireEvent.click(extent());
    expect(extent()).not.toBeChecked();
    const near = screen.getByRole("status", { name: "Satellite availability" });
    expect(near).toHaveTextContent("Select at least one product (step 4).");
    expect(screen.getByRole("status", { name: "Before you run" })).toHaveTextContent("Select at least one product (step 4).");
    const runButton = screen.getByRole("button", { name: "Run analysis" });
    expect(runButton).toBeDisabled();
    expect(within(screen.getByRole("complementary", { name: "Run summary" })).getByText("Products").nextElementSibling).toHaveTextContent("None selected");
    setDate(dates().targetStart, "2024-05-20"); // a date change must not call the preflight without a product
    expect(preflightAnalysisMock.mock.calls.length).toBe(calls);
    expect(document.body).not.toHaveTextContent("One or more request fields are invalid");
    fireEvent.click(extent());
    expect(runButton).toBeEnabled();
    await waitFor(() => expect(preflightAnalysisMock.mock.calls.length).toBeGreaterThan(calls));
    expect(submitAnalysisMock).not.toHaveBeenCalled();
  });

  it("refuses a baseline that overlaps or follows the target before asking the API", async () => {
    renderBuilder();
    await waitFor(() => expect(preflightAnalysisMock).toHaveBeenCalled());
    const calls = preflightAnalysisMock.mock.calls.length;
    setDate(dates().baselineStart, "2025-03-15"); setDate(dates().baselineLast, "2025-04-10"); // target is 1–31 Mar 2025
    expect(await screen.findByText(/The baseline must end before the target starts; the two windows may not overlap\./)).toBeInTheDocument();
    expect(preflightAnalysisMock.mock.calls.length).toBe(calls);
  });

  it("turns API validation errors into specific messages, never the generic one", async () => {
    const error = (details: unknown[]) => new ApiError({ message: "One or more request fields are invalid.", status: 422, code: "validation_error", details });
    expect(describeApiError(error([{ loc: ["body", "products"], msg: "List should have at least 1 item after validation, not 0" }]))).toBe("Select at least one product (step 4).");
    expect(describeApiError(error([{ loc: ["body", "parameters", "workflow", "source"], msg: "Value error, Baseline must precede target without overlap" }])))
      .toBe("The baseline must end before the target starts; the two windows may not overlap.");
    expect(describeApiError(error([{ loc: ["body", "gis_metadata", "acquisition_date"], msg: "Input should be a valid date" }]))).toBe("gis_metadata › acquisition_date: Input should be a valid date");
    preflightAnalysisMock.mockRejectedValue(error([{ loc: ["body", "products"], msg: "List should have at least 1 item after validation, not 0" }]));
    renderBuilder();
    const panel = await screen.findByRole("status", { name: "Satellite availability" });
    await waitFor(() => expect(panel).toHaveTextContent("Select at least one product (step 4)."));
    expect(panel).not.toHaveTextContent("One or more request fields are invalid");
  });
});
