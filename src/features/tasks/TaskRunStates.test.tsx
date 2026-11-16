// UI refresh P5: the analysis page while running, after a failure, when canceled and when completed.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { fetchAoi } from "../aois/aoisApi";
import { fetchTaskArchive } from "./taskArchive";
import { TaskDetailPage } from "./TaskDetailPage";
import { cancelTask, fetchTask, retryTask, type TaskStatusResponse } from "./tasksApi";
import { explainFailure, submittedPeriods, timeline } from "./taskView";

vi.mock("./tasksApi", async (load) => ({ ...await load<typeof import("./tasksApi")>(), fetchTask: vi.fn(), cancelTask: vi.fn(), retryTask: vi.fn() }));
vi.mock("./taskArchive", async (load) => ({ ...await load<typeof import("./taskArchive")>(), fetchTaskArchive: vi.fn() }));
vi.mock("../aois/aoisApi", async (load) => ({ ...await load<typeof import("../aois/aoisApi")>(), fetchAoi: vi.fn() }));
vi.mock("./TaskArchive", () => ({ TaskArchive: () => <section>Execution archive</section> }));

type ExecutionEvent = components["schemas"]["ExecutionEvent"];
const event = (sequence: number, action: ExecutionEvent["action"], at: string, progress_pct = 0): ExecutionEvent => ({ sequence, action, at, progress_pct, actor_id: null, previous_sha256: "0", sha256: "1" });
const task = (overrides: Partial<TaskStatusResponse>): TaskStatusResponse => ({
  id: "row", task_id: "7f3c2a10-0000-4000-8000-000000000001", task_type: "analysis", engine_key: "firris", project_id: "p1", aoi_id: "aoi-1",
  status: "running", progress_pct: 48, created_at: "2026-11-16T09:00:00Z", started_at: "2026-11-16T09:01:00Z", completed_at: null,
  error_summary: null, error_message: null, result_reference: null, result_payload: null,
  execution: { origin: "api", parameters_sha256: "x", aoi_sha256: null, aoi_snapshot: null, aoi_source_lineage: null, implementation_sha256: "y", cache_policy: "c", retry_of: null, schema_version: "1.0",
    events: [event(1, "submitted", "2026-11-16T09:00:00Z"), event(2, "enqueued", "2026-11-16T09:00:01Z"), event(3, "started", "2026-11-16T09:01:00Z"), event(4, "progress", "2026-11-16T09:02:00Z", 20), event(5, "progress", "2026-11-16T09:03:00Z", 48)] },
  ...overrides,
} as TaskStatusResponse);
const COVERAGE = "Valid pixel coverage 63.21% is below the configured 70.00% threshold.";

function setup(data: TaskStatusResponse) {
  vi.mocked(fetchTask).mockResolvedValue(data);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/tasks/${data.task_id}`]}><Routes><Route path="/tasks/:taskId" element={<TaskDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(fetchAoi).mockReset().mockResolvedValue({ id: "aoi-1", name: "Manyoni check" } as never);
  vi.mocked(fetchTaskArchive).mockReset().mockResolvedValue({ archive: { submitted_parameters: { parameters: { workflow: { source: { target_period: { start: "2024-05-24", end: "2024-05-26" }, baseline_period: { start: "2022-08-28", end: "2022-09-03" } } } } }, results: [], task: {}, limitations: [] }, disposition: null } as never);
  vi.mocked(cancelTask).mockReset();
  vi.mocked(retryTask).mockReset();
});

describe("view helpers", () => {
  it("explains the allow-listed failures in plain language, with figures parsed from the message", () => {
    expect(explainFailure(COVERAGE)).toMatchObject({ title: "Not enough valid radar data over the area", detail: "Valid data covers 63.21% of the area; at least 70% is required for a reliable result." });
    expect(explainFailure("No Sentinel-1 scene over the area between 2024-05-21 and 2024-05-23 (end date exclusive).").title).toBe("No Sentinel-1 pass in the chosen window");
    expect(explainFailure("No Sentinel-1 scene over the area between 21 and 22 May 2024.").title).toBe("No Sentinel-1 pass in the chosen window"); // P6 wording
    expect(explainFailure("No Sentinel-1 scene over the area on 21 May 2024.").title).toBe("No Sentinel-1 pass in the chosen window");
    expect(explainFailure("The target and baseline windows must each contain Sentinel-1 passes from exactly one relative orbit, the same in both (target: 57; baseline: 130).").title).toBe("The radar orbits do not match");
    expect(explainFailure("Analysis execution failed. Please retry or contact support with the request ID.")).toMatchObject({ title: "The analysis could not be completed", detail: null });
  });
  it("merges consecutive progress reports and labels the stop", () => {
    const items = timeline([...task({}).execution!.events, event(6, "failed", "2026-11-16T09:04:00Z", 48)]);
    expect(items.map((item) => item.label)).toEqual(["Submitted", "Queued", "Started", "Progress 48%", "Stopped"]);
    expect(items.at(-1)?.tone).toBe("stop");
  });
  it("reads the submitted windows and shows them inclusive", () => {
    expect(submittedPeriods({ workflow: { source: { target_period: { start: "2024-05-24", end: "2024-05-26" } } } })).toEqual({ target: "24–25 May 2024", baseline: null });
    expect(submittedPeriods(null)).toEqual({ target: null, baseline: null });
  });
});

describe("running", () => {
  it("shows the real progress, the run's steps, the note and Cancel", async () => {
    vi.mocked(cancelTask).mockResolvedValue(task({ status: "canceled" }));
    setup(task({}));
    expect(await screen.findByRole("heading", { level: 1, name: "Manyoni check" })).toBeInTheDocument();
    expect(await screen.findByText("Target 24–25 May 2024 · Baseline 28 Aug – 2 Sep 2022")).toBeInTheDocument();
    expect(screen.getByText("Running · 48%")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Analysis progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "48");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("Started 16 Nov 2026, 09:01 UTC")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What the analysis does" }).nextElementSibling?.querySelectorAll("li")).toHaveLength(6);
    expect(screen.getByRole("note")).toHaveTextContent("You can leave this page. The analysis keeps running");
    expect(screen.getByRole("heading", { name: "Run history" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    await waitFor(() => expect(cancelTask).toHaveBeenCalledWith("7f3c2a10-0000-4000-8000-000000000001"));
  });

  it("omits the dates when the archive is not readable for the role", async () => {
    vi.mocked(fetchTaskArchive).mockRejectedValue(new Error("Forbidden"));
    setup(task({ status: "queued", started_at: null, progress_pct: 0 }));
    expect(await screen.findByRole("heading", { name: "Waiting to start" })).toBeInTheDocument();
    expect(screen.getByText("Submitted 16 Nov 2026, 09:00 UTC")).toBeInTheDocument();
    expect(screen.queryByText(/^Target /)).toBeNull();
  });
});

describe("failed", () => {
  it("explains the failure, shows the API message and figures, offers next steps, and where it stopped", async () => {
    vi.mocked(retryTask).mockResolvedValue(task({ task_id: "retry-1", status: "queued" }));
    const failed = task({ status: "failed", progress_pct: 48, error_summary: COVERAGE, completed_at: "2026-11-16T09:04:00Z",
      execution: { ...task({}).execution!, events: [...task({}).execution!.events, event(6, "failed", "2026-11-16T09:04:00Z", 48)] } });
    setup(failed);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { level: 2, name: "Not enough valid radar data over the area" })).toBeInTheDocument();
    expect(alert).toHaveTextContent("Valid data covers 63.21% of the area; at least 70% is required for a reliable result.");
    expect(alert).toHaveTextContent(COVERAGE);
    expect(alert).toHaveTextContent("Redraw the area so it lies inside the radar swath.");
    expect(within(alert).getByRole("link", { name: "Edit and retry" })).toHaveAttribute("href", "/frris/analyses/new?project=p1&aoi_id=aoi-1");
    expect(within(alert).getByRole("link", { name: "Back to analyses" })).toHaveAttribute("href", "/frris/analyses");
    expect(alert).toHaveTextContent("Reference: 7f3c2a10-0000-4000-8000-000000000001. Share this reference with support if you need help. No result was saved.");
    const history = screen.getByRole("region", { name: "Where it stopped" });
    expect(within(history).getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent)).toEqual(["Submitted", "Queued", "Started", "Progress 48%", "Stopped: not enough valid radar data over the area"]);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: "Retry with the same settings" }));
    await waitFor(() => expect(retryTask).toHaveBeenCalled());
  });

  it("keeps the generic message and the reference for other failures", async () => {
    setup(task({ status: "failed", error_summary: "Analysis execution failed. Please retry or contact support with the request ID." }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "The analysis could not be completed" })).toBeInTheDocument();
    expect(alert).toHaveTextContent("Analysis execution failed. Please retry or contact support with the request ID.");
    expect(alert).toHaveTextContent("Reference: 7f3c2a10-0000-4000-8000-000000000001");
  });
});

describe("canceled and completed", () => {
  it("canceled: says so and offers to run it again", async () => {
    setup(task({ status: "canceled" }));
    expect(await screen.findByRole("heading", { name: "Analysis canceled" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run it again" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("completed: opens the result", async () => {
    setup(task({ status: "completed", progress_pct: 100, completed_at: "2026-11-16T09:20:00Z", result_reference: { id: "res-9", created_at: "", result_type: "flood_mapping", version: 1 } }));
    expect(await screen.findByRole("heading", { name: "Analysis completed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open result" })).toHaveAttribute("href", "/results/res-9");
    expect(screen.getByText("Finished 16 Nov 2026, 09:20 UTC.")).toBeInTheDocument();
  });
});
