import { describe, expect, it } from "vitest";
import { getGeometryBoundingBox, parseGeoJsonGeometry } from "./geometry";

describe("AOI GeoJSON geometry", () => {
  it("parses a Polygon and computes its analysis bounds", () => {
    const geometry = parseGeoJsonGeometry(JSON.stringify({
      type: "Polygon",
      coordinates: [[[36.7, -1.4], [37.1, -1.4], [37.1, -1.1], [36.7, -1.1], [36.7, -1.4]]],
    }));

    expect(getGeometryBoundingBox(geometry)).toEqual({ west: 36.7, south: -1.4, east: 37.1, north: -1.1 });
  });

  it("supports MultiPolygon coordinates", () => {
    const geometry = parseGeoJsonGeometry(JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [[[1, 2], [2, 2], [2, 3], [1, 3], [1, 2]]],
        [[[5, 6], [6, 6], [6, 7], [5, 7], [5, 6]]],
      ],
    }));

    expect(getGeometryBoundingBox(geometry)).toEqual({ west: 1, south: 2, east: 6, north: 7 });
  });

  it.each([
    "not-json",
    JSON.stringify({ type: "Point", coordinates: [1, 2] }),
    JSON.stringify({ type: "Polygon", coordinates: [] }),
  ])("rejects unsupported or invalid geometry", (value) => {
    expect(() => parseGeoJsonGeometry(value)).toThrow();
  });
});
