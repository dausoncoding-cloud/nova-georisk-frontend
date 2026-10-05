import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TaskListPage } from "./TaskListPage";

vi.mock("./tasksApi", async (loadOriginal) => {
  const original = await loadOriginal<typeof import("./tasksApi")>();
  return { ...original, fetchTasks: vi.fn().mockResolvedValue({ total: 1, limit: 50, offset: 0, items: [{ id: "row-1", task_id: "task-1", task_type: "analysis", engine_key: "firris", project_id: "project-1", aoi_id: "aoi-1", status: "running", progress_pct: 48, created_at: "2026-01-01T00:00:00Z", started_at: "2026-01-01T00:00:10Z", completed_at: null, error_summary: null, error_message: null, result_reference: null, result_payload: null }] }) };
});

describe("Task center", () => {
  it("renders status navigation and safe worker progress", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/tasks"]}><Routes><Route path="/tasks" element={<TaskListPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Task center")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "running" })).toBeInTheDocument();
    expect(screen.getAllByText("48%").length).toBeGreaterThan(0);
    expect(screen.getByText("firris")).toBeInTheDocument();
  });
});
