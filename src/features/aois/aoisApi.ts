import { apiClient, assertSuccessfulResponse, unwrapResponse } from "../../shared/api/client";
import type { components } from "../../shared/api/generated/nova-browser-api";

export type AoiCreateRequest = components["schemas"]["AOICreateRequest"];
export type AoiUpdateRequest = components["schemas"]["AOIUpdateRequest"];
export type AoiResponse = components["schemas"]["AOIResponse"];

export async function fetchProjectAois(projectId: string, limit = 200, offset = 0) {
  return unwrapResponse(
    await apiClient.GET("/api/v1/projects/{project_id}/aois", {
      params: { path: { project_id: projectId }, query: { limit, offset } },
    }),
  );
}

export async function fetchAoi(aoiId: string) {
  return unwrapResponse(
    await apiClient.GET("/api/v1/aoi/{aoi_id}", {
      params: { path: { aoi_id: aoiId } },
    }),
  );
}

export async function createAoi(body: AoiCreateRequest) {
  return unwrapResponse(await apiClient.POST("/api/v1/aoi", { body }));
}

export async function searchAdministrativeBoundaries(projectId: string, query: string, limit = 25, offset = 0) {
  return unwrapResponse(await apiClient.GET("/api/v1/aoi/admin-boundaries", {
    params: { query: { project_id: projectId, query, limit, offset } },
  }));
}

export async function createAoiFromAdministrativeBoundary(body: components["schemas"]["AdministrativeBoundaryAOICreate"]) {
  return unwrapResponse(await apiClient.POST("/api/v1/aoi/from-admin-boundary", { body }));
}

export async function uploadShapefileAoi(projectId: string, name: string, file: File) {
  return unwrapResponse(await apiClient.POST("/api/v1/aoi/upload", {
    body: { project_id: projectId, name, file: file as unknown as string },
    bodySerializer(body) {
      const form = new FormData();
      form.set("project_id", body.project_id);
      form.set("name", body.name);
      form.set("file", file);
      return form;
    },
  }));
}

export async function inspectGeopackageLayers(projectId: string, file: File) {
  return unwrapResponse(await apiClient.POST("/api/v1/aoi/gpkg-layers", {
    body: { project_id: projectId, file: file as unknown as string },
    bodySerializer(body) {
      const form = new FormData();
      form.set("project_id", body.project_id);
      form.set("file", file);
      return form;
    },
  }));
}

export async function uploadGeopackageAoi(projectId: string, name: string, file: File, layerName?: string) {
  return unwrapResponse(await apiClient.POST("/api/v1/aoi/upload-gpkg", {
    body: { project_id: projectId, name, file: file as unknown as string, layer_name: layerName },
    bodySerializer(body) {
      const form = new FormData();
      form.set("project_id", body.project_id);
      form.set("name", body.name);
      form.set("file", file);
      if (body.layer_name) form.set("layer_name", body.layer_name);
      return form;
    },
  }));
}

export async function updateAoi(aoiId: string, body: AoiUpdateRequest) {
  return unwrapResponse(
    await apiClient.PATCH("/api/v1/aoi/{aoi_id}", {
      params: { path: { aoi_id: aoiId } },
      body,
    }),
  );
}

export async function deleteAoi(aoiId: string): Promise<void> {
  const result = await apiClient.DELETE("/api/v1/aoi/{aoi_id}", {
    params: { path: { aoi_id: aoiId } },
  });
  assertSuccessfulResponse(result);
}
