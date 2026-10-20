import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ResultDetailPage } from "./ResultDetailPage";

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
    const validation = await screen.findByRole("tab", { name: "Validation", selected: true });
    expect(screen.getByText("Coverage too low")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    fireEvent.keyDown(validation, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Execution", selected: true })).toHaveFocus();
    expect(screen.getByText("Execution archive content")).toBeInTheDocument();
  });
});
