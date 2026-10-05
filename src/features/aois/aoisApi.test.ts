import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../shared/api/client";
import { createAoiFromAdministrativeBoundary, inspectGeopackageLayers, searchAdministrativeBoundaries, uploadGeopackageAoi } from "./aoisApi";

describe("GeoPackage AOI upload contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends a protected same-origin multipart request without client-side geometry claims", async () => {
    const projectId = "00000000-0000-0000-0000-000000000001";
    const file = new File(["gpkg fixture"], "boundary.gpkg", { type: "application/geopackage+sqlite3" });
    const responseData = {
      id: "00000000-0000-0000-0000-000000000002", project_id: projectId, name: "Floodplain",
      source_type: "gpkg", geometry: { type: "Polygon", coordinates: [[[36, -2], [37, -2], [37, -1], [36, -2]]] },
      crs: "EPSG:4326", stats: { area_m2: 1, area_hectares: 0.0001, area_km2: 0.000001, perimeter_m: 4 }, created_at: "2026-09-29T00:00:00Z",
    };
    const postMock = vi.spyOn(apiClient, "POST").mockResolvedValue({ data: responseData, response: new Response(null, { status: 201 }) } as never);

    const result = await uploadGeopackageAoi(projectId, "Floodplain", file, "reviewed-polygon");
    expect(postMock.mock.calls[0]?.[0]).toBe("/api/v1/aoi/upload-gpkg");
    const options = postMock.mock.calls[0]?.[1] as unknown as { body: { project_id: string; name: string; layer_name?: string }; bodySerializer: (body: { project_id: string; name: string; layer_name?: string }) => FormData };
    const form = options.bodySerializer(options.body);
    expect(form.get("project_id")).toBe(projectId);
    expect(form.get("name")).toBe("Floodplain");
    expect(form.get("layer_name")).toBe("reviewed-polygon");
    expect((form.get("file") as File).name).toBe("boundary.gpkg");
    expect(form.has("geometry")).toBe(false);
    expect(result.source_type).toBe("gpkg");
  });

  it("inspects only authorized polygon-layer names before upload", async () => {
    const projectId = "00000000-0000-0000-0000-000000000001";
    const file = new File(["fixture"], "multi.gpkg");
    const postMock = vi.spyOn(apiClient, "POST").mockResolvedValue({
      data: { layers: [{ name: "upstream", geometry_type: "Polygon" }] },
      response: new Response(null, { status: 200 }),
    } as never);
    const result = await inspectGeopackageLayers(projectId, file);
    expect(postMock.mock.calls[0]?.[0]).toBe("/api/v1/aoi/gpkg-layers");
    const options = postMock.mock.calls[0]?.[1] as unknown as { body: { project_id: string }; bodySerializer: (body: { project_id: string }) => FormData };
    const form = options.bodySerializer(options.body);
    expect(form.get("project_id")).toBe(projectId);
    expect((form.get("file") as File).name).toBe("multi.gpkg");
    expect(result.layers[0]?.name).toBe("upstream");
  });
});

describe("approved administrative-boundary AOI contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("searches only the requested project through the generated same-origin GET contract", async () => {
    const projectId = "00000000-0000-0000-0000-000000000001";
    const getMock = vi.spyOn(apiClient, "GET").mockResolvedValue({
      data: { items: [], total: 0, limit: 25, offset: 25 },
      response: new Response(null, { status: 200 }),
    } as never);
    const page = await searchAdministrativeBoundaries(projectId, "ward", 25, 25);
    expect(getMock).toHaveBeenCalledWith("/api/v1/aoi/admin-boundaries", {
      params: { query: { project_id: projectId, query: "ward", limit: 25, offset: 25 } },
    });
    expect(page.total).toBe(0);
  });

  it("submits identifiers only and preserves server-returned lineage", async () => {
    const request = { project_id: "00000000-0000-0000-0000-000000000001",
      dataset_id: "00000000-0000-0000-0000-000000000002", spatial_unit_id: "ward-7", name: "Selected ward" };
    const lineage = { dataset_id: request.dataset_id, spatial_unit_id: request.spatial_unit_id, sha256: "a".repeat(64) };
    const postMock = vi.spyOn(apiClient, "POST").mockResolvedValue({
      data: { id: "00000000-0000-0000-0000-000000000003", source_type: "admin_boundary", source_lineage: lineage },
      response: new Response(null, { status: 201 }),
    } as never);
    const result = await createAoiFromAdministrativeBoundary(request);
    expect(postMock).toHaveBeenCalledWith("/api/v1/aoi/from-admin-boundary", { body: request });
    const options = postMock.mock.calls[0]?.[1] as unknown as { body: object };
    expect(Object.keys(options.body)).not.toContain("geometry");
    expect(result.source_lineage).toEqual(lineage);
  });
});
