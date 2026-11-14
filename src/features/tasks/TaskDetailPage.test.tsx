import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TaskDetailPage } from "./TaskDetailPage";

const { fetchTaskMock } = vi.hoisted(() => ({ fetchTaskMock: vi.fn() }));
vi.mock("./tasksApi", async (importOriginal) => ({ ...(await importOriginal<typeof import("./tasksApi")>()), fetchTask: fetchTaskMock }));
vi.mock("./TaskArchive", () => ({ TaskArchive: () => null }));

const failed = (error_summary: string) => ({ id: "row-1", task_id: "task-7f3c", task_type: "analysis", engine_key: "firris", project_id: "project-1", aoi_id: "aoi-1", status: "failed", progress_pct: 0, created_at: "2026-11-14T00:00:00Z", started_at: "2026-11-14T00:00:01Z", completed_at: "2026-11-14T00:00:02Z", error_summary, error_message: null, result_reference: null, result_payload: null });

async function renderTask() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/tasks/task-7f3c"]}><Routes><Route path="/tasks/:taskId" element={<TaskDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  return screen.findByRole("alert");
}

describe("task failure message (plan 4.2)", () => {
  it("shows an allow-listed acquisition message as written, with the reference", async () => {
    fetchTaskMock.mockResolvedValue(failed("No Sentinel-1 scene over the area between 2024-05-21 and 2024-05-23 (end date exclusive)."));
    const panel = await renderTask();
    expect(panel).toHaveTextContent("No Sentinel-1 scene over the area between 2024-05-21 and 2024-05-23");
    expect(panel).toHaveTextContent("Reference: task-7f3c");
  });

  it("keeps the generic message plus the reference for any other failure", async () => {
    fetchTaskMock.mockResolvedValue(failed("Analysis execution failed. Please retry or contact support with the request ID."));
    const panel = await renderTask();
    expect(panel).toHaveTextContent("Analysis execution failed. Please retry or contact support");
    expect(panel).toHaveTextContent("Reference: task-7f3c");
  });
});
