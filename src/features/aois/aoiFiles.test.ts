import { describe, expect, it } from "vitest";
import { estimateGeometryStats, normalizeGeoJson, parseKml, validateShapefileEntries } from "./aoiFiles";

describe("AOI import validation", () => {
  it("requires a complete single shapefile", () => {
    expect(validateShapefileEntries(["basin.shp", "basin.shx", "basin.dbf", "basin.prj"])).toEqual({ hasProjection: true });
    expect(() => validateShapefileEntries(["basin.shp", "basin.dbf"])).toThrow(/\.shx/);
    expect(() => validateShapefileEntries(["../basin.shp", "basin.shx", "basin.dbf"])).toThrow(/unsafe/);
  });

  it("normalizes polygon feature collections without accepting mixed geometry", () => {
    const result = normalizeGeoJson({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }] });
    expect(result.featureCount).toBe(1);
    expect(result.geometry.type).toBe("MultiPolygon");
    expect(() => normalizeGeoJson({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] } }] })).toThrow(/polygon/i);
  });

  it("preserves KML interior rings and multipart boundaries", () => {
    const ring = "36,-2 37,-2 37,-1 36,-1 36,-2";
    const ring2 = "38,-2 39,-2 39,-1 38,-1 38,-2";
    const hole = "36.2,-1.8 36.8,-1.8 36.8,-1.2 36.2,-1.2 36.2,-1.8";
    const parsed = parseKml(`<kml><Document><Placemark><MultiGeometry><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>${hole}</coordinates></LinearRing></innerBoundaryIs></Polygon><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring2}</coordinates></LinearRing></outerBoundaryIs></Polygon></MultiGeometry></Placemark></Document></kml>`);
    expect(parsed.featureCount).toBe(2);
    expect(parsed.geometry.type).toBe("MultiPolygon");
    expect(parsed.geometry.coordinates[0]).toHaveLength(2);
    expect(() => parseKml("<kml><Polygon><outerBoundaryIs><LinearRing><coordinates>36,-1 37,-1 37,-2</coordinates></LinearRing></outerBoundaryIs></Polygon></kml>")).toThrow(/closed|valid/i);
    expect(() => parseKml(`<kml><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>40,-2 41,-2 41,-1 40,-1 40,-2</coordinates></LinearRing></innerBoundaryIs></Polygon></kml>`)).toThrow(/inside/);
    expect(() => parseKml("<kml><Polygon><outerBoundaryIs><LinearRing><coordinates>36,-2 37,-1 36,-1 37,-2 36,-2</coordinates></LinearRing></outerBoundaryIs></Polygon></kml>")).toThrow(/self-intersect/);
    expect(() => parseKml(`<kml><MultiGeometry><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></MultiGeometry></kml>`)).toThrow(/overlap|touch/);
  });

  it("subtracts holes and does not connect disjoint polygons in preview statistics", () => {
    const square = [[36, -2], [37, -2], [37, -1], [36, -1], [36, -2]];
    const hole = [[36.2, -1.8], [36.8, -1.8], [36.8, -1.2], [36.2, -1.2], [36.2, -1.8]];
    const shifted = square.map(([x, y]) => [x! + 2, y!]);
    const whole = estimateGeometryStats({ type: "Polygon", coordinates: [square] });
    const withHole = estimateGeometryStats({ type: "Polygon", coordinates: [square, hole] });
    const multipart = estimateGeometryStats({ type: "MultiPolygon", coordinates: [[square], [shifted]] });
    expect(withHole.areaKm2).toBeLessThan(whole.areaKm2);
    expect(withHole.perimeterM).toBeGreaterThan(whole.perimeterM);
    expect(multipart.areaKm2).toBeCloseTo(2 * whole.areaKm2, 6);
    expect(multipart.perimeterM).toBeCloseTo(2 * whole.perimeterM, 6);
  });
});
