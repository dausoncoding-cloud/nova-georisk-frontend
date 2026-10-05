import { describe, expect, it } from "vitest";
import { colorizeDelivered, deliveredBands, reprojectRaster, reprojectVector, validDisplayBounds, styleDeliveredVector } from "./deliveredGis";
import type { ResultLayer } from "./gisViewer";
const layer = { product_key: "depth", legend: { entries: [{ label: "Shallow", max: 2, color_hex: "#0000ff" }, { label: "Deep", color: "#ff0000" }] } } as unknown as ResultLayer;
describe("delivered GIS semantics", () => {
  it("uses delivered breaks rather than sample scaling, including nodata", () => {
    const display = colorizeDelivered([1, 2, 3, -9999], -9999, layer);
    expect(Array.from(display.rgba)).toEqual([0,0,255,255,0,0,255,255,255,0,0,255,0,0,0,0]);
    expect(deliveredBands(layer.legend)[0]?.label).toBe("Shallow");
  });
  it("assigns vector colors from delivered spatial-unit scores", () => {
    const vector = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[[0,0],[1,0],[0,1],[0,0]]] }, properties: { value: 3 } }] };
    expect(styleDeliveredVector(vector, layer).features[0]?.properties?.__displayColor).toBe("#ff0000");
    expect(() => styleDeliveredVector({ ...vector, features: [{ ...vector.features[0]!, properties: {} }] }, layer)).toThrow("spatial-unit score");
  });
  it("fails closed for missing legends and invalid display envelopes", () => {
    expect(() => colorizeDelivered([1], null, { ...layer, legend: null })).toThrow("legend unavailable");
    expect(validDisplayBounds({ west: 500000, east: 600000, south: 0, north: 100 })).toBeNull();
  });
  it("warps Web Mercator raster colors into the delivered WGS84 display envelope", () => {
    const raster = { width: 2, height: 2, rgba: new Uint8ClampedArray([0,0,255,255,255,0,0,255,0,255,0,255,0,0,0,0]), minimum: 0, maximum: 2, nodata: -9999, crs: "EPSG:3857", bounds: { west: -111319.490793, east: 111319.490793, south: -111325.142866, north: 111325.142866 } };
    const display = reprojectRaster(raster, { west: -1, east: 1, south: -1, north: 1 });
    expect(display.crs).toBe("EPSG:4326");
    expect(display.rgba).toEqual(raster.rgba);
    expect(() => reprojectRaster({ ...raster, crs: "EPSG:999999" }, display.bounds)).toThrow("reprojection unavailable");
  });
  it("reprojects UTM vector coordinates and preserves WGS84 raster cells", () => {
    const vector = reprojectVector({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[500000,0],[500001,0],[500000,1],[500000,0]]] } }] }, "EPSG:32636");
    expect((vector.features[0]!.geometry.coordinates as number[][][])[0]![0]![0]).toBeCloseTo(33);
    const raster = { width: 2, height: 1, rgba: new Uint8ClampedArray([0,0,255,255,255,0,0,255]), minimum: 0, maximum: 1, nodata: null, crs: "EPSG:4326", bounds: { west: 0, east: 2, south: 0, north: 1 } };
    expect(reprojectRaster(raster, raster.bounds).rgba).toEqual(raster.rgba);
  });
});
