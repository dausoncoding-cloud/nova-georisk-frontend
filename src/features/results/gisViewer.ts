import type { TypedArray } from "geotiff";
import type { components } from "../../shared/api/generated/nova-browser-api";
import type { GeoJsonGeometry } from "../aois/geometry";

export type ResultArtifact = components["schemas"]["ResultProductResponse"];
export type ResultLayer = components["schemas"]["ResultLayerResponse"];
export type Bounds = { west: number; south: number; east: number; north: number };
export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{ type: "Feature"; geometry: GeoJsonGeometry; properties?: Record<string, unknown> }>;
};

export type RasterData = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  minimum: number;
  maximum: number;
  nodata: number | null;
  bounds: Bounds;
  crs: string | null;
};

export type LegendEntry = { label: string; color: string };
export type LayerLegend = { minimum?: number; maximum?: number; entries: LegendEntry[] };

const PALETTES: Record<string, string[]> = {
  flood_extent: ["#228B22", "#00BFFF"],
  flood_probability: ["#0B6E4F", "#F6D55C", "#ED553B", "#7A0019"],
  flood_depth: ["#d9f0ff", "#49a9e8", "#08306b"],
  flood_velocity: ["#d9f0ff", "#f6d55c", "#d62728"],
  flood_hazard: ["#0b6e4f", "#f6d55c", "#f28e2b", "#c1121f"],
  flood_risk: ["#0b6e4f", "#f6d55c", "#f28e2b", "#7a0019"],
};

const DEFAULT_PALETTE = ["#0b3c5d", "#00b4d8", "#f9c74f", "#d00000"];

export function artifactsForLayer(layer: ResultLayer, artifacts: ResultArtifact[]): ResultArtifact[] {
  return artifacts.filter((artifact) => layer.artifact_keys.includes(artifact.key));
}

export function selectRasterArtifact(layer: ResultLayer, artifacts: ResultArtifact[]): ResultArtifact | undefined {
  const candidates = artifactsForLayer(layer, artifacts);
  return candidates.find((item) => item.delivery_type === "cog")
    ?? candidates.find((item) => item.delivery_type === "geotiff")
    ?? candidates.find((item) => item.artifact_type === "preview");
}

export function selectVectorArtifact(layer: ResultLayer, artifacts: ResultArtifact[]): ResultArtifact | undefined {
  return artifactsForLayer(layer, artifacts).find((item) => item.artifact_type === "vector");
}

function hexRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16)) as [number, number, number];
}

export function colorizeRaster(
  values: ArrayLike<number>,
  nodata: number | null,
  palette: string[],
  forcedMinimum?: number,
  forcedMaximum?: number,
): Pick<RasterData, "rgba" | "minimum" | "maximum"> {
  const finite = Array.from(values).filter((value) => Number.isFinite(value) && (nodata === null || value !== nodata));
  if (finite.length === 0) throw new Error("Raster contains no displayable cells.");
  const minimum = forcedMinimum ?? Math.min(...finite);
  const maximum = forcedMaximum ?? Math.max(...finite);
  const colors = palette.map(hexRgb);
  const rgba = new Uint8ClampedArray(values.length * 4);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined || !Number.isFinite(value) || (nodata !== null && value === nodata)) continue;
    const normalized = maximum === minimum ? 0 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
    const position = normalized * (colors.length - 1);
    const low = Math.floor(position);
    const high = Math.min(colors.length - 1, low + 1);
    const fraction = position - low;
    const lowColor = colors[low]!;
    const highColor = colors[high]!;
    rgba[index * 4] = Math.round(lowColor[0] * (1 - fraction) + highColor[0] * fraction);
    rgba[index * 4 + 1] = Math.round(lowColor[1] * (1 - fraction) + highColor[1] * fraction);
    rgba[index * 4 + 2] = Math.round(lowColor[2] * (1 - fraction) + highColor[2] * fraction);
    rgba[index * 4 + 3] = 255;
  }
  return { rgba, minimum, maximum };
}

function crsFromGeoKeys(keys: Partial<Record<string, unknown>> | null): string | null {
  const projected = keys?.ProjectedCSTypeGeoKey;
  const geographic = keys?.GeographicTypeGeoKey;
  if (typeof projected === "number" && projected > 0 && projected !== 32767) return `EPSG:${projected}`;
  if (typeof geographic === "number" && geographic > 0 && geographic !== 32767) return `EPSG:${geographic}`;
  return null;
}

export async function loadProtectedRaster(
  url: string,
  productKey: string,
  signal?: AbortSignal,
): Promise<RasterData> {
  const { fromUrl } = await import("geotiff");
  let tiff;
  try {
    // GeoTIFF.js requests only the byte ranges needed for the selected image.
    // Relative same-origin URLs carry the opaque session cookie under Fetch's
    // default `same-origin` credentials policy.
    tiff = await fromUrl(url, {
      headers: { Accept: "image/tiff" },
      maxRanges: 1,
      allowFullFile: false,
    }, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("This protected raster could not be loaded. Verify access and byte-range support.");
  }
  const image = await tiff.getImage();
  const sourceWidth = image.getWidth();
  const sourceHeight = image.getHeight();
  const scale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const values = await image.readRasters({ samples: [0], width, height, interleave: true, signal }) as TypedArray & { width: number; height: number };
  const rawNoData = image.getGDALNoData();
  const nodata = rawNoData === null ? null : Number(rawNoData);
  const palette = PALETTES[productKey] ?? DEFAULT_PALETTE;
  const colored = colorizeRaster(values, nodata, palette, productKey === "flood_probability" ? 0 : undefined, productKey === "flood_probability" ? 1 : undefined);
  const bbox = image.getBoundingBox();
  const west = bbox[0]!;
  const south = bbox[1]!;
  const east = bbox[2]!;
  const north = bbox[3]!;
  return {
    width,
    height,
    ...colored,
    nodata,
    bounds: { west, south, east, north },
    crs: crsFromGeoKeys(image.getGeoKeys() as Partial<Record<string, unknown>> | null),
  };
}

export async function loadProtectedVector(url: string, signal?: AbortSignal): Promise<GeoJsonFeatureCollection> {
  const response = await fetch(url, { credentials: "include", headers: { Accept: "application/geo+json" }, signal });
  if (!response.ok) throw new Error(response.status === 403 || response.status === 404 ? "This vector layer is unavailable for the current organization." : `Vector layer request failed (${response.status}).`);
  const value = await response.json() as GeoJsonFeatureCollection;
  if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) throw new Error("The protected vector artifact is not valid GeoJSON.");
  return value;
}

function rings(geometry: GeoJsonGeometry): Array<Array<[number, number]>> {
  if (geometry.type === "Polygon") return geometry.coordinates as Array<Array<[number, number]>>;
  return (geometry.coordinates as Array<Array<Array<[number, number]>>>).flatMap((polygon) => polygon);
}

function projectPoint(point: [number, number], sourceCrs: string, targetCrs: string): [number, number] {
  const source = sourceCrs.toUpperCase();
  const target = targetCrs.toUpperCase();
  if (source === target) return point;
  if (source === "EPSG:4326" && target === "EPSG:3857") {
    const latitude = Math.max(-85.05112878, Math.min(85.05112878, point[1]));
    return [point[0] * 20037508.34 / 180, Math.log(Math.tan((90 + latitude) * Math.PI / 360)) * 20037508.34 / Math.PI];
  }
  if (source === "EPSG:3857" && target === "EPSG:4326") {
    return [point[0] * 180 / 20037508.34, 180 / Math.PI * (2 * Math.atan(Math.exp(point[1] * Math.PI / 20037508.34)) - Math.PI / 2)];
  }
  throw new Error(`CRS transformation from ${sourceCrs} to ${targetCrs} is not available in this browser.`);
}

export function geometryPaths(
  geometries: GeoJsonGeometry[],
  sourceCrs: string,
  targetCrs: string,
  bounds: Bounds,
  width = 800,
  height = 500,
): string[] {
  const spanX = bounds.east - bounds.west;
  const spanY = bounds.north - bounds.south;
  if (spanX <= 0 || spanY <= 0) throw new Error("Layer bounds are invalid.");
  return geometries.flatMap((geometry) => rings(geometry).map((ring) => ring.map((point, index) => {
    const [x, y] = projectPoint(point, sourceCrs, targetCrs);
    const px = ((x - bounds.west) / spanX) * width;
    const py = ((bounds.north - y) / spanY) * height;
    return `${index === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
  }).join(" ") + " Z"));
}

export function defaultLegend(productKey: string, minimum?: number, maximum?: number): LayerLegend {
  if (productKey === "flood_extent") return { entries: [{ label: "Non-flooded", color: "#dce8e5" }, { label: "Flooded", color: "#00a6d6" }] };
  if (productKey === "flood_probability") return { minimum: 0, maximum: 1, entries: [{ label: "Low", color: "#0b6e4f" }, { label: "Moderate", color: "#f6d55c" }, { label: "High", color: "#ed553b" }, { label: "Extreme", color: "#7a0019" }] };
  const palette = PALETTES[productKey] ?? DEFAULT_PALETTE;
  return { minimum, maximum, entries: palette.map((color, index) => ({ label: index === 0 ? "Low" : index === palette.length - 1 ? "High" : "", color })) };
}
