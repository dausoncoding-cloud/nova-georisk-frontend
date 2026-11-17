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
  it("Depth & Exposure: shows the GloFAS depth legend with permanent water as its own grey class", () => {
    // The legend as the backend writes it (hazard_exports.depth_legend): -1 = permanent water, 0 = dry, then depth bins.
    const depth = { product_key: "modelled_flood_depth_rp100", legend: { entries: [
      { label: "Permanent water (not flooding)", color: "#8C8C8C", max: -0.5 }, { label: "Dry (< 0.1 m)", color: "#EDEDED", max: 0.05 },
      { label: "0.1–0.5 m", color: "#C6DBEF", max: 0.4995 }, { label: "0.5–1 m", color: "#9ECAE1", max: 0.9995 },
      { label: "1–2 m", color: "#6BAED6", max: 1.9995 }, { label: "2–3 m", color: "#3182BD", max: 2.9995 }, { label: "> 3 m", color: "#08519C" },
    ] } } as unknown as ResultLayer;
    const { rgba } = colorizeDelivered([-1, 0, 0.5, 1.5, 3.6, -9999], -9999, depth);
    const colour = (i: number) => Array.from(rgba.slice(i * 4, i * 4 + 4));
    expect(colour(0)).toEqual([0x8c, 0x8c, 0x8c, 255]);
    expect(colour(1)).toEqual([0xed, 0xed, 0xed, 255]);
    expect(colour(2)).toEqual([0x9e, 0xca, 0xe1, 255]); // 0.5 m starts the 0.5–1 m bin, as in the statistics
    expect(colour(3)).toEqual([0x6b, 0xae, 0xd6, 255]);
    expect(colour(4)).toEqual([0x08, 0x51, 0x9c, 255]);
    expect(colour(5)).toEqual([0, 0, 0, 0]); // no data stays transparent
    const permanent = { product_key: "modelled_permanent_water", legend: { entries: [{ label: "Permanent water (not flooding)", color: "#8C8C8C", max: null }] } } as unknown as ResultLayer;
    expect(Array.from(colorizeDelivered([1, -9999], -9999, permanent).rgba.slice(0, 4))).toEqual([0x8c, 0x8c, 0x8c, 255]);
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
