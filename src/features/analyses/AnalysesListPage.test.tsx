import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProjectAois } from "../aois/aoisApi";
import { fetchProjects } from "../projects/projectsApi";
import { fetchResults } from "../results/resultsApi";
import { fetchTasks, type TaskStatusResponse } from "../tasks/tasksApi";
import { AnalysesListPage } from "./AnalysesListPage";
import { buildRows, latestResult, matchesSearch, statusPresentation } from "./analysesView";

vi.mock("../tasks/tasksApi", async (load) => ({ ...await load<typeof import("../tasks/tasksApi")>(), fetchTasks: vi.fn() }));
vi.mock("../results/resultsApi", async (load) => ({ ...await load<typeof import("../results/resultsApi")>(), fetchResults: vi.fn() }));
vi.mock("../projects/projectsApi", async (load) => ({ ...await load<typeof import("../projects/projectsApi")>(), fetchProjects: vi.fn() }));
vi.mock("../aois/aoisApi", async (load) => ({ ...await load<typeof import("../aois/aoisApi")>(), fetchProjectAois: vi.fn() }));

const task = (overrides: Partial<TaskStatusResponse>): TaskStatusResponse => ({
  id: "row", task_id: "task-0000-aaaa", task_type: "analysis", engine_key: "firris", project_id: "p1", aoi_id: "aoi-1",
  status: "completed", progress_pct: 100, created_at: "2026-11-14T09:00:00Z", started_at: null, completed_at: null,
  error_summary: null, error_message: null, result_reference: null, result_payload: null, execution: null, ...overrides,
} as TaskStatusResponse);

const scope = (name: string, title: string, oa: number | null) => ({ scope: name, title, overall_accuracy_pct: oa, cohens_kappa: 0.4461, f1_flooded: 0.4771, roc_auc: 0.8049 });
const result = (overrides: Record<string, unknown> = {}) => ({
  id: "res-1", aoi_id: "aoi-1", project_id: "p1", task_id: "task-completed",
  overview: { headline: { target_period: "24–25 May 2024" } },
  validation_dashboard: { accuracy_assessment: { independent_status: "assessed", scopes: [scope("internal_screening", "Internal agreement (SAR screening labels)", 99.1), scope("independent_optical", "Independent accuracy (Sentinel-2 reference)", 94.21)] } },
  ...overrides,
});

const TASKS = [
  task({ id: "r1", task_id: "task-completed", status: "completed", result_reference: { id: "res-1", created_at: "", result_type: "flood", version: 1 } }),
  task({ id: "r2", task_id: "task-running-xyz", status: "running", progress_pct: 48, aoi_id: "aoi-2" }),
  task({ id: "r3", task_id: "task-failed-abc", status: "failed", aoi_id: "aoi-missing", error_summary: "Not enough valid radar data over the area (minimum 70%)." }),
];

function Where() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; }

function renderPage(path = "/frris/analyses") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path="/frris/analyses" element={<AnalysesListPage />} /></Routes><Where /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(fetchTasks).mockReset().mockResolvedValue({ items: TASKS, total: 3, limit: 50, offset: 0 });
  vi.mocked(fetchResults).mockReset().mockResolvedValue({ items: [result()], total: 1, limit: 50, offset: 0 } as never);
  vi.mocked(fetchProjects).mockReset().mockResolvedValue([{ id: "p1", name: "Rufiji monitoring" }] as never);
  vi.mocked(fetchProjectAois).mockReset().mockResolvedValue({ items: [
    { id: "aoi-1", name: "Rufiji floodplain 2024", stats: { area_km2: 98.84 } },
    { id: "aoi-2", name: "Manyoni check", stats: { area_km2: 122.5 } },
  ], total: 2, limit: 200, offset: 0 } as never);
});

describe("analyses view model", () => {
  it("labels statuses as in the design and keeps progress for running runs", () => {
    expect(statusPresentation({ status: "completed", progress_pct: 100 })).toEqual({ label: "Completed", tone: "success" });
    expect(statusPresentation({ status: "running", progress_pct: 48.4 })).toEqual({ label: "Running · 48%", tone: "info" });
    expect(statusPresentation({ status: "failed", progress_pct: 30 })).toEqual({ label: "Needs attention", tone: "warning" });
    expect(statusPresentation({ status: "canceled", progress_pct: 0 }).tone).toBe("neutral");
  });

  it("builds rows only from API data and leaves unknown values empty", () => {
    const rows = buildRows(TASKS, new Map([["aoi-1", { id: "aoi-1", name: "Rufiji", stats: { area_km2: 98.8 } }]]), new Map([["p1", "Project"]]), new Map([["res-1", result() as never]]));
    expect(rows[0]).toMatchObject({ name: "Rufiji", areaKm2: 98.8, targetPeriod: "24–25 May 2024", href: "/results/res-1" });
    expect(rows[1]).toMatchObject({ name: null, areaKm2: null, targetPeriod: null, href: "/tasks/task-running-xyz", attention: null });
    expect(rows[2]!.attention).toMatch(/minimum 70%/);
    expect(matchesSearch(rows[0]!, "rufi")).toBe(true);
    expect(matchesSearch(rows[0]!, "manyoni")).toBe(false);
  });

  it("takes headline metrics from the independent scope when it was assessed", () => {
    const latest = latestResult([result() as never])!;
    expect(latest.basis).toBe("Independent accuracy (Sentinel-2 reference)");
    expect(latest.independent).toBe(true);
    expect(latest.metrics).toEqual([
      { label: "Overall accuracy", value: "94.2%" }, { label: "Kappa", value: "0.446" },
      { label: "F1 (flood candidate)", value: "0.477" }, { label: "AUC", value: "0.805" },
    ]);
  });

  it("labels internal agreement as such when no independent assessment exists and omits missing metrics", () => {
    const internalOnly = result({ validation_dashboard: { accuracy_assessment: { independent_status: "not_assessable", scopes: [scope("internal_screening", "Internal agreement (SAR screening labels)", null)] } } });
    const latest = latestResult([internalOnly as never])!;
    expect(latest.basis).toBe("Internal agreement (SAR screening labels)");
    expect(latest.independentNote).toBe("Independent accuracy: not assessable.");
    expect(latest.metrics.map((metric) => metric.label)).toEqual(["Kappa", "F1 (flood candidate)", "AUC"]);
    expect(latestResult([])).toBeNull();
    expect(latestResult([result({ validation_dashboard: null }) as never])!.metrics).toEqual([]);
  });
});

describe("Analyses list", () => {
  it("lists analyses with AOI names, areas, periods and status pills", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Analyses" })).toBeInTheDocument();
    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getAllByRole("link", { name: "Rufiji floodplain 2024" })).toHaveLength(1));
    const [, completed, running, failed] = within(table).getAllByRole("row");
    expect(within(completed!).getByRole("link", { name: "Rufiji floodplain 2024" })).toHaveAttribute("href", "/results/res-1");
    expect(completed).toHaveTextContent("24–25 May 2024");
    expect(completed).toHaveTextContent("98.8 km²");
    expect(completed).toHaveTextContent("Completed");
    expect(completed).toHaveTextContent("14 Nov 2026");
    expect(within(running!).getByRole("link", { name: "Manyoni check" })).toHaveAttribute("href", "/tasks/task-running-xyz");
    expect(running).toHaveTextContent("Running · 48%");
    expect(running).toHaveTextContent("Not available"); // no target period until the run completes
    expect(within(failed!).getByRole("link", { name: "Analysis task-fai" })).toBeInTheDocument();
    expect(failed).toHaveTextContent("Needs attention");
    expect(failed).toHaveTextContent("Not enough valid radar data over the area (minimum 70%).");
    expect(document.body.textContent).not.toMatch(/\[[^\]]*\]/);
    expect(fetchResults).toHaveBeenCalledWith(expect.objectContaining({ engine_key: "firris" }));
  });

  it("shows each row's own project and area, not the first project's", async () => {
    vi.mocked(fetchTasks).mockResolvedValue({ items: [
      task({ id: "a", task_id: "task-a", project_id: "p1", aoi_id: "aoi-1", status: "queued" }),
      task({ id: "b", task_id: "task-b", project_id: "p2", aoi_id: "aoi-9", status: "queued" }),
      task({ id: "c", task_id: "task-c", project_id: "p1", aoi_id: "aoi-2", status: "queued" }),
    ], total: 3, limit: 50, offset: 0 });
    vi.mocked(fetchProjects).mockResolvedValue([{ id: "p1", name: "Rufiji monitoring" }, { id: "p2", name: "Kilombero valley" }] as never);
    vi.mocked(fetchProjectAois).mockImplementation(async (projectId: string) => ({ items: projectId === "p2"
      ? [{ id: "aoi-9", name: "Kilombero floodplain", stats: { area_km2: 240.9 } }]
      : [{ id: "aoi-1", name: "Rufiji floodplain 2024", stats: { area_km2: 98.84 } }, { id: "aoi-2", name: "Manyoni check", stats: { area_km2: 122.5 } }],
    total: 1, limit: 200, offset: 0 }) as never);
    renderPage();
    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getByRole("link", { name: "Kilombero floodplain" })).toBeInTheDocument());
    const [, first, second, third] = within(table).getAllByRole("row");
    expect(first).toHaveTextContent("Rufiji floodplain 2024"); expect(first).toHaveTextContent("Rufiji monitoring"); expect(first).not.toHaveTextContent("Kilombero valley");
    expect(second).toHaveTextContent("Kilombero floodplain"); expect(second).toHaveTextContent("Kilombero valley"); expect(second).toHaveTextContent("240.9 km²");
    expect(second).not.toHaveTextContent("Rufiji monitoring");
    expect(third).toHaveTextContent("Manyoni check"); expect(third).toHaveTextContent("Rufiji monitoring");
    expect(fetchProjectAois).toHaveBeenCalledWith("p1");
    expect(fetchProjectAois).toHaveBeenCalledWith("p2");
  });

  it("shows the latest completed result with its accuracy basis and metrics", async () => {
    renderPage();
    const card = await screen.findByRole("region", { name: "Latest completed" });
    await waitFor(() => expect(within(card).getByRole("link", { name: "Rufiji floodplain 2024" })).toHaveAttribute("href", "/results/res-1"));
    expect(card).toHaveTextContent("Independent accuracy (Sentinel-2 reference)");
    expect(card).toHaveTextContent("Target period 24–25 May 2024");
    const terms = within(card).getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Overall accuracy", "Kappa", "F1 (flood candidate)", "AUC"]);
    expect(within(card).getAllByRole("definition").map((value) => value.textContent)).toEqual(["94.2%", "0.446", "0.477", "0.805"]);
  });

  it("omits the latest-result card when there is no result", async () => {
    vi.mocked(fetchResults).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 } as never);
    renderPage();
    await screen.findByRole("table");
    expect(screen.queryByRole("region", { name: "Latest completed" })).toBeNull();
  });

  it("filters by status through the URL and resets pagination", async () => {
    renderPage("/frris/analyses?offset=50");
    const group = await screen.findByRole("group", { name: "Filter by status" });
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "Needs attention" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/frris/analyses?status=failed");
    await waitFor(() => expect(fetchTasks).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed", offset: 0 })));
    expect(within(group).getByRole("button", { name: "Needs attention" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers to show all analyses when a status filter has no match", async () => {
    vi.mocked(fetchTasks).mockImplementation(async (filters) => filters?.status === "canceled" ? { items: [], total: 0, limit: 50, offset: 0 } : { items: TASKS, total: 3, limit: 50, offset: 0 });
    renderPage("/frris/analyses?status=canceled");
    fireEvent.click(await screen.findByRole("button", { name: "Show all analyses" }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/frris\/analyses$/);
    expect(screen.queryByRole("heading", { name: "No analyses yet" })).toBeNull();
    expect(await screen.findByRole("link", { name: "Manyoni check" })).toBeInTheDocument();
  });

  it("searches the analyses on the page", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Manyoni check" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search analyses on this page" }), { target: { value: "manyoni" } });
    expect(within(screen.getByRole("table")).queryByRole("link", { name: "Rufiji floodplain 2024" })).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("1 of 3 analyses on this page match.")).toBeInTheDocument();
  });

  it("shows the empty state when the organization has no analyses", async () => {
    vi.mocked(fetchTasks).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    vi.mocked(fetchResults).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 } as never);
    renderPage();
    const empty = await screen.findByRole("region", { name: "No analyses yet" });
    expect(empty).toHaveTextContent("Start your first flood analysis by drawing or uploading an area and choosing a baseline and a target period.");
    expect(within(empty).getByRole("link", { name: "New analysis" })).toHaveAttribute("href", "/frris/analyses/new");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("group", { name: "Filter by status" })).toBeNull();
  });

  it("keeps rows when names or periods cannot be loaded, and says so", async () => {
    vi.mocked(fetchProjectAois).mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText(/could not be loaded; they are shown as “—”/)).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("shows an error with retry when analyses cannot be loaded", async () => {
    vi.mocked(fetchTasks).mockRejectedValue(new Error("Service unavailable"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Analyses could not be loaded");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
