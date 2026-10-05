import type { components } from "../../shared/api/generated/nova-browser-api";

export type GeoJsonGeometry = components["schemas"]["GeoJSONGeometry"];
export type BoundingBox = components["schemas"]["BoundingBox"];

function collectPositions(value: unknown, output: Array<[number, number]>): void {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  ) {
    output.push([value[0], value[1]]);
    return;
  }
  value.forEach((item) => collectPositions(item, output));
}

export function parseGeoJsonGeometry(value: string): GeoJsonGeometry {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Geometry must be valid GeoJSON JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Geometry must be a GeoJSON object.");
  }
  const geometry = parsed as Record<string, unknown>;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    throw new Error("Only Polygon and MultiPolygon geometries are supported.");
  }
  const positions: Array<[number, number]> = [];
  collectPositions(geometry.coordinates, positions);
  if (positions.length < 4) {
    throw new Error("Geometry must contain a valid polygon coordinate ring.");
  }
  return { type: geometry.type, coordinates: geometry.coordinates as unknown[] };
}

export function getGeometryBoundingBox(geometry: GeoJsonGeometry): BoundingBox {
  const positions: Array<[number, number]> = [];
  collectPositions(geometry.coordinates, positions);
  if (positions.length === 0) throw new Error("AOI geometry has no valid coordinates.");

  const xs = positions.map(([x]) => x);
  const ys = positions.map(([, y]) => y);
  return {
    west: Math.min(...xs),
    south: Math.min(...ys),
    east: Math.max(...xs),
    north: Math.max(...ys),
  };
}

export const samplePolygon = JSON.stringify(
  {
    type: "Polygon",
    coordinates: [[[36.75, -1.35], [36.95, -1.35], [36.95, -1.15], [36.75, -1.15], [36.75, -1.35]]],
  },
  null,
  2,
);
