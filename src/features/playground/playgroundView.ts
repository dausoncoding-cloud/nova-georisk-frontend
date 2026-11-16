// Area playground (P6): pure helpers. Sizes come from POST /api/v1/aois/capacity (the preflight's own rule);
// nothing here estimates a download size.
import type { GeoJsonGeometry } from "../aois/geometry";
import type { AreaCapacityResponse } from "../aois/aoisApi";

export type Fix = "trim" | "split" | "coarser";
export type LonLat = [number, number];

export const MIB = 1_048_576;
export const mib = (bytes: number) => bytes / MIB;
export const mibText = (bytes: number) => `${mib(bytes).toFixed(1)}`;

export function polygonFromPoints(points: readonly LonLat[]): GeoJsonGeometry | null {
  if (points.length < 3) return null;
  const ring = [...points.map(([lng, lat]) => [lng, lat]), [points[0]![0], points[0]![1]]];
  return { type: "Polygon", coordinates: [ring] };
}

export function rectangleFromCorners(a: LonLat, b: LonLat): GeoJsonGeometry | null {
  const [west, east] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [south, north] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  if (west === east || south === north) return null;
  return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] };
}

/** Outer rings as [lat, lng] lists, for Leaflet. */
export function leafletRings(geometry: GeoJsonGeometry | null | undefined): [number, number][][] {
  if (!geometry) return [];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return polygons.map((polygon) => (polygon[0] ?? []).map(([lng, lat]) => [lat!, lng!] as [number, number]));
}

export type Tone = "ok" | "near" | "over";
export const toneOf = (status: AreaCapacityResponse["status"]): Tone => status === "fits" ? "ok" : status;

/** What the panel shows for the current choice: the original check, or the applied fix. */
export function currentFigures(check: AreaCapacityResponse, applied: Fix | null) {
  const limit = check.capacity.limit_bytes;
  if (applied === "trim" && check.trim) {
    const bytes = check.trim.capacity.estimated_request_bytes;
    return { bytes, limit, tone: (bytes / limit >= check.near_ratio ? "near" : "ok") as Tone, areaKm2: check.trim.area_km2, scale: check.capacity.scale_m,
      message: "Trimmed area fits. Move the box to cover the part you need most." };
  }
  if (applied === "split" && check.split) {
    const bytes = Math.max(...check.split.parts.map((part) => part.capacity.estimated_request_bytes));
    return { bytes, limit, tone: (bytes / limit >= check.near_ratio ? "near" : "ok") as Tone, areaKm2: check.area_km2, scale: check.capacity.scale_m,
      message: `Split into ${check.split.parts.length} parts; each fits on its own (largest part shown).` };
  }
  if (applied === "coarser" && check.coarser) {
    const bytes = check.coarser.capacity.estimated_request_bytes;
    return { bytes, limit, tone: (bytes / limit >= check.near_ratio ? "near" : "ok") as Tone, areaKm2: check.area_km2, scale: check.coarser.scale_m,
      message: `Whole area fits at ${check.coarser.scale_m} m resolution.` };
  }
  return { bytes: check.capacity.estimated_request_bytes, limit, tone: toneOf(check.status), areaKm2: check.area_km2, scale: check.capacity.scale_m, message: check.message };
}

/** The areas that will be saved for the current choice. */
export function areasToSave(check: AreaCapacityResponse, applied: Fix | null, geometry: GeoJsonGeometry, name: string) {
  if (applied === "trim" && check.trim) return [{ name: `${name} (trimmed)`, geometry: check.trim.geometry }];
  if (applied === "split" && check.split) {
    const count = check.split.parts.length;
    return check.split.parts.map((part, index) => ({ name: `${name} (part ${index + 1} of ${count})`, geometry: part.geometry }));
  }
  return [{ name, geometry }];
}

export function featureCollection(areas: { name: string; geometry: GeoJsonGeometry }[], scaleM: number) {
  return {
    type: "FeatureCollection",
    features: areas.map((area) => ({ type: "Feature", properties: { name: area.name, scale_m: scaleM, crs: "EPSG:4326" }, geometry: area.geometry })),
  };
}

export function slug(text: string) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "area";
}

/** Projects rings into a viewBox for the small option previews. */
export function previewPaths(geometries: (GeoJsonGeometry | null | undefined)[], boxes: (number[] | null | undefined)[], size = 120) {
  const rings = geometries.flatMap((geometry) => leafletRings(geometry).map((ring) => ring.map(([lat, lng]) => [lng, lat] as LonLat)));
  const boxRings = boxes.filter((box): box is number[] => Array.isArray(box) && box.length === 4)
    .map(([west, south, east, north]) => [[west!, south!], [east!, south!], [east!, north!], [west!, north!], [west!, south!]] as LonLat[]);
  const all = [...rings, ...boxRings].flat();
  if (!all.length) return { rings: [], boxes: [] };
  const xs = all.map(([x]) => x), ys = all.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const pad = 8, scale = (size - 2 * pad) / span;
  const offsetX = pad + ((size - 2 * pad) - (maxX - minX) * scale) / 2, offsetY = pad + ((size - 2 * pad) - (maxY - minY) * scale) / 2;
  const toPath = (ring: LonLat[]) => ring.map(([x, y], index) => `${index ? "L" : "M"}${(offsetX + (x - minX) * scale).toFixed(1)},${(offsetY + (maxY - y) * scale).toFixed(1)}`).join(" ") + " Z";
  return { rings: rings.map(toPath), boxes: boxRings.map(toPath) };
}
