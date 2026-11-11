import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ResultDetailPage } from "./ResultDetailPage";
import { fetchResult } from "./resultsApi";

vi.mock("./resultsApi", async load => ({ ...await load<typeof import("./resultsApi")>(), fetchResult: vi.fn().mockResolvedValue({
  id: "result-1", project_id: "project-1", task_id: "task-1", aoi_id: null, engine_key: "firris", result_type: "flood_mapping", version: 1,
  created_at: "2026-01-01T00:00:00Z", summary: { status: "completed", quality: { status: "failed", reason: "Coverage too low" }, validation: { accuracy: 0 } },
  products: [], exports: [], layers: [], provenance: { target_period: { start: "2025-03-01", end: "2025-04-01" } }, analytics: null,
}) }));
vi.mock("./FIRRISGisViewer", () => ({ FIRRISGisViewer: () => <div>Map preview</div> }));
vi.mock("../tasks/TaskArchive", () => ({ TaskArchive: () => <div>Execution archive content</div> }));

function setup(path = "/results/result-1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/results/:resultId" element={<ResultDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
describe("Result workspace", () => {
  it("opens a compact overview and renders other sections only on selection", async () => {
    setup();
    expect(await screen.findByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument();
    expect(screen.getByText(/scientific quality gate failed/)).toBeInTheDocument();
    expect(screen.getByText("2025-03-01 → 2025-04-01")).toBeInTheDocument();
    expect(screen.queryByText("Execution archive content")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quantitative analytics" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Execution" }));
    expect(screen.getByText("Execution archive content")).toBeInTheDocument();
    expect(screen.queryByText("Map preview")).not.toBeInTheDocument();
  });
  it("supports direct tab links and keyboard tab navigation", async () => {
    setup("/results/result-1?tab=validation");
    const validation = await screen.findByRole("tab", { name: "Accuracy assessment", selected: true });
    expect(screen.getByText("Coverage too low")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    fireEvent.keyDown(validation, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Execution", selected: true })).toHaveFocus();
    expect(screen.getByText("Execution archive content")).toBeInTheDocument();
  });
});

describe("Accuracy assessment framing (F2)", () => {
  const basis = {
    statement: "Internal agreement with SAR screening labels — not independent flood-map accuracy.",
    label_source: "SAR screening pseudo-label", rule: "label = (sar_change_db <= -1.5 dB) AND (slope < 15 deg)",
    features_overlapping_rule: ["sar_change", "slope"], split_method: "stratified random pixel split; same scene",
    n_train_per_class: { "0": 140, "1": 210 }, n_test_per_class: { "0": 60, "1": 90 },
  };
  function withDashboard(dashboard: Record<string, unknown> | null) {
    vi.mocked(fetchResult).mockResolvedValueOnce({
      id: "result-1", project_id: "project-1", task_id: "task-1", aoi_id: null, engine_key: "firris", result_type: "flood_mapping", version: 1,
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", summary: { status: "completed", validation: { overall_accuracy: 1 } },
      products: [], exports: [], layers: [], provenance: {}, analytics: null,
      validation_dashboard: dashboard as never,
    } as never);
  }
  it("states the reference basis, n and split, and that independent validation was not performed", async () => {
    withDashboard({ kind: "binary", metrics: {}, availability: {}, plots: [], scope: basis.statement, units: "binary_class_0_1", limitations: [], reference_basis: basis, independent_validation: "not_performed" });
    setup("/results/result-1?tab=validation");
    expect(await screen.findByRole("heading", { name: "Accuracy assessment" })).toBeInTheDocument();
    expect(screen.getAllByText(basis.statement).length).toBeGreaterThan(0);
    expect(screen.getByText(/Held-out n = 150 \(class 0: 60, class 1: 90\)/)).toBeInTheDocument();
    expect(screen.getByText(/Training n = 350/)).toBeInTheDocument();
    expect(screen.getByText("Model features that also define the labels").nextElementSibling).toHaveTextContent("sar_change, slope");
    expect(screen.getAllByText(basis.split_method).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Internal agreement metrics" })).toBeInTheDocument();
    expect(screen.queryByText("Scientific validation")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByText("Independent validation").nextElementSibling).toHaveTextContent("Not performed");
  });
  it("shows Not performed for legacy results without the new fields", async () => {
    const legacy = { kind: "binary", metrics: {}, availability: {}, plots: [], scope: "declared_holdout", units: "binary_class_0_1", limitations: [] };
    expect(legacy).not.toHaveProperty("reference_basis");
    expect(legacy).not.toHaveProperty("independent_validation");
    withDashboard(legacy);
    setup();
    expect((await screen.findByText("Independent validation")).nextElementSibling).toHaveTextContent("Not performed");
    fireEvent.click(screen.getByRole("tab", { name: "Accuracy assessment" }));
    expect(screen.getByRole("heading", { name: "Accuracy assessment" })).toBeInTheDocument();
    expect(screen.getByText("Independent validation: Not performed")).toBeInTheDocument();
    expect(screen.queryByText("Reference basis")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Internal agreement metrics" })).toBeInTheDocument();
  });
});

describe("Legacy interpretation notice (1.6)", () => {
  const notice = "Produced before the JRC never-water correction; analysis was restricted to historically wet pixels. Metrics are internal agreement with SAR screening labels. Downloaded files from this run use older labels (\u201cFlood Probability\u201d, \u201cFlood Risk Index Summary\u201d); the score is a model confidence score, not a probability of flooding.";
  function result(interpretation_notice: string | null | undefined) {
    vi.mocked(fetchResult).mockResolvedValueOnce({
      id: "result-1", project_id: "project-1", task_id: "task-1", aoi_id: null, engine_key: "firris", result_type: "flood_mapping", version: 1,
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", summary: { status: "completed" },
      products: [], exports: [], layers: [], provenance: {}, analytics: null, ...(interpretation_notice === undefined ? {} : { interpretation_notice }),
    } as never);
  }
  it("shows the notice as a status banner on every tab of a legacy result", async () => {
    result(notice);
    setup();
    const banner = await screen.findByRole("status", { name: "Interpretation notice" });
    expect(banner).toHaveTextContent(notice);
    fireEvent.click(screen.getByRole("tab", { name: "Accuracy assessment" }));
    expect(screen.getByRole("status", { name: "Interpretation notice" })).toHaveTextContent("model confidence score");
  });
  it.each([null, undefined])("shows no banner when the API supplies %s", async (value) => {
    result(value);
    setup();
    await screen.findByRole("tab", { name: "Overview", selected: true });
    expect(screen.queryByRole("status", { name: "Interpretation notice" })).not.toBeInTheDocument();
  });
});
