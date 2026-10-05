import type { components } from "../../shared/api/generated/nova-browser-api";
import { apiClient, unwrapResponse } from "../../shared/api/client";

export type TaskStatus = components["schemas"]["TaskStatus"];
export type TaskStatusResponse = components["schemas"]["TaskStatusResponse"];

export type TaskFilters = {
  project_id?: string;
  aoi_id?: string;
  status?: TaskStatus;
  task_type?: components["schemas"]["TaskType"];
  engine_key?: string;
  limit?: number;
  offset?: number;
};

export async function fetchTasks(filters: TaskFilters = {}) {
  return unwrapResponse(await apiClient.GET("/api/v1/tasks", { params: { query: filters } }));
}

export async function fetchTask(taskId: string) {
  return unwrapResponse(
    await apiClient.GET("/api/v1/tasks/{task_id}", { params: { path: { task_id: taskId } } }),
  );
}

export async function cancelTask(taskId: string) {
  return unwrapResponse(
    await apiClient.POST("/api/v1/tasks/{task_id}/cancel", { params: { path: { task_id: taskId } } }),
  );
}

export async function retryTask(taskId: string) {
  return unwrapResponse(
    await apiClient.POST("/api/v1/tasks/{task_id}/retry", { params: { path: { task_id: taskId } } }),
  );
}

export function taskPollingInterval(task: TaskStatusResponse | undefined): number | false {
  return task?.status === "queued" || task?.status === "running" ? 2_000 : false;
}
