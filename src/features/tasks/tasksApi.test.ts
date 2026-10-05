import { describe, expect, it } from "vitest";
import { taskPollingInterval, type TaskStatusResponse } from "./tasksApi";

function task(status: TaskStatusResponse["status"]): TaskStatusResponse {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    task_id: "00000000-0000-0000-0000-000000000011",
    project_id: "00000000-0000-0000-0000-000000000012",
    engine_key: "firris",
    task_type: "analysis",
    status,
    progress_pct: 0,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("task polling", () => {
  it.each(["queued", "running"] as const)("polls a %s task every two seconds", (status) => {
    expect(taskPollingInterval(task(status))).toBe(2_000);
  });

  it.each(["completed", "failed", "canceled"] as const)("stops polling a %s task", (status) => {
    expect(taskPollingInterval(task(status))).toBe(false);
  });

  it("does not poll before a task is loaded", () => {
    expect(taskPollingInterval(undefined)).toBe(false);
  });
});
