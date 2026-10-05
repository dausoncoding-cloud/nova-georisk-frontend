import { afterEach, describe, expect, it, vi } from "vitest";
import { writeArrayBuffer } from "geotiff";
import type { GeoJsonGeometry } from "../aois/geometry";
import {
  colorizeRaster,
  geometryPaths,
  loadProtectedVector,
  loadProtectedRaster,
  selectRasterArtifact,
  type ResultArtifact,
  type ResultLayer,
} from "./gisViewer";

function artifact(key: string, deliveryType: string, artifactType: ResultArtifact["artifact_type"]): ResultArtifact {
  return {
    key, label: key, url: `/protected/${key}`, media_type: "image/tiff",
    delivery_type: deliveryType, format: deliveryType, artifact_type: artifactType,
    role: "product", product_key: "flood_probability", schema_version: "1.0", result_version: 1,
  };
}

const layer = {
  key: "flood_probability_raster", label: "Flood probability", product_key: "flood_probability",
  layer_type: "raster", renderable: true, available_delivery_types: ["geotiff", "cog", "preview"],
  planned_delivery_types: [], artifact_keys: ["preview", "geotiff", "cog"],
} as ResultLayer;

afterEach(() => vi.restoreAllMocks());

describe("GIS viewer utilities", () => {
  it("prefers a protected COG over GeoTIFF and preview representations", () => {
    const selected = selectRasterArtifact(layer, [artifact("preview", "preview", "preview"), artifact("geotiff", "geotiff", "raster"), artifact("cog", "cog", "raster")]);
    expect(selected?.key).toBe("cog");
  });

  it("colorizes finite cells and keeps nodata transparent", () => {
    const result = colorizeRaster([0, 0.5, 1, -9999], -9999, ["#000000", "#ffffff"], 0, 1);
    expect(Array.from(result.rgba.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(result.rgba.slice(8, 12))).toEqual([255, 255, 255, 255]);
    expect(Array.from(result.rgba.slice(12, 16))).toEqual([0, 0, 0, 0]);
  });

  it("projects an AOI into the layer viewport", () => {
    const geometry = { type: "Polygon", coordinates: [[[36, -2], [37, -2], [37, -1], [36, -2]]] } as GeoJsonGeometry;
    const paths = geometryPaths([geometry], "EPSG:4326", "EPSG:4326", { west: 36, south: -2, east: 37, north: -1 }, 100, 100);
    expect(paths[0]).toContain("M0.00 100.00");
    expect(paths[0]).toContain("L100.00 0.00");
  });

  it("loads protected vectors with browser credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200, headers: { "content-type": "application/geo+json" } }));
    await expect(loadProtectedVector("/api/v1/results/one/products/vector")).resolves.toMatchObject({ type: "FeatureCollection" });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/results/one/products/vector", expect.objectContaining({ credentials: "include" }));
  });

  it("decodes a protected georeferenced GeoTIFF into display pixels", async () => {
    const buffer = writeArrayBuffer(new Float32Array([0, 0.5, 1, -9999]), {
      width: 2,
      height: 2,
      ModelPixelScale: [0.5, 0.5, 0],
      ModelTiepoint: [0, 0, 0, 36, -1, 0],
      GeographicTypeGeoKey: 4326,
      GDAL_NODATA: "-9999",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const range = new Headers(init?.headers).get("range");
      expect(range).toMatch(/^bytes=\d+-\d+$/);
      const [startText, endText] = range!.slice(6).split("-");
      const start = Number(startText);
      const end = Math.min(Number(endText), buffer.byteLength - 1);
      return new Response(buffer.slice(start, end + 1), {
        status: 206,
        headers: {
          "accept-ranges": "bytes",
          "content-range": `bytes ${start}-${end}/${buffer.byteLength}`,
          "content-length": String(end - start + 1),
          "content-type": "image/tiff",
        },
      });
    });
    const raster = await loadProtectedRaster("/api/v1/results/one/products/cog", "flood_probability");
    expect(raster).toMatchObject({ width: 2, height: 2, nodata: -9999, crs: "EPSG:4326" });
    expect(raster.bounds).toEqual({ west: 36, south: -2, east: 37, north: -1 });
    expect(Array.from(raster.rgba.slice(12, 16))).toEqual([0, 0, 0, 0]);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes protected authorization failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    await expect(loadProtectedVector("/api/v1/results/other/products/vector")).rejects.toThrow("current organization");
  });
});
