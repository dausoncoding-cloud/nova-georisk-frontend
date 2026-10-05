import { apiClient, unwrapResponse } from "../../shared/api/client";
import { assertSuccessfulResponse } from "../../shared/api/client";
import type { components } from "../../shared/api/generated/nova-browser-api";

type BrowserProjectCreateRequest = components["schemas"]["ProjectCreateRequest"];
export type ProjectCreateRequest = Pick<
  BrowserProjectCreateRequest,
  "name" | "description" | "crs"
> & Required<Pick<BrowserProjectCreateRequest, "engine_key">>;
export type ProjectUpdateRequest = components["schemas"]["ProjectUpdateRequest"];

export async function fetchProjects() {
  return unwrapResponse(await apiClient.GET("/api/v1/projects"));
}

export async function fetchProject(projectId: string) {
  return unwrapResponse(
    await apiClient.GET("/api/v1/projects/{project_id}", {
      params: { path: { project_id: projectId } },
    }),
  );
}

export async function createProject(body: ProjectCreateRequest) {
  return unwrapResponse(await apiClient.POST("/api/v1/projects", { body }));
}

export async function updateProject(projectId: string, body: ProjectUpdateRequest) {
  return unwrapResponse(
    await apiClient.PATCH("/api/v1/projects/{project_id}", {
      params: { path: { project_id: projectId } },
      body,
    }),
  );
}

export async function deleteProject(projectId: string): Promise<void> {
  const result = await apiClient.DELETE("/api/v1/projects/{project_id}", {
    params: { path: { project_id: projectId } },
  });
  assertSuccessfulResponse(result);
}
