import proj4 from "proj4";
import type { Bounds, GeoJsonFeatureCollection, RasterData, ResultLayer } from "./gisViewer";

export type DeliveredBand = { label: string; color: string; value?: number; min?: number; max?: number };
export function deliveredBands(legend: ResultLayer["legend"]): DeliveredBand[] {
  const raw = Array.isArray(legend) ? legend : (legend as Record<string, unknown> | null)?.entries;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const color = item.color ?? item.color_hex;
    if (typeof item.label !== "string" || typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) return [];
    return [{ label: item.label, color, value: item.value, min: item.min, max: item.max }];
  });
}
export function sourceProjection(crs: string): string {
  if (proj4.defs(crs)) return crs;
  const code = Number(crs.toUpperCase().replace("EPSG:", ""));
  if ((code >= 32601 && code <= 32660) || (code >= 32701 && code <= 32760)) return `+proj=utm +zone=${code % 100} ${code >= 32700 ? "+south" : ""} +datum=WGS84 +units=m +no_defs`;
  throw new Error(`Interactive reprojection unavailable for ${crs}. Download the authoritative GIS artifact.`);
}
export function validDisplayBounds(bounds: Bounds | null | undefined): Bounds | null {
  return bounds && Object.values(bounds).every(Number.isFinite) && bounds.west >= -180 && bounds.east <= 180 && bounds.south >= -90 && bounds.north <= 90 && bounds.west < bounds.east && bounds.south < bounds.north ? bounds : null;
}
export function colorizeDelivered(values: ArrayLike<number>, nodata: number | null, layer: ResultLayer) {
  const bands = deliveredBands(layer.legend);
  if (!bands.length) throw new Error("Product legend unavailable; raster colors cannot be assigned safely.");
  const explicit = bands.every(band => typeof band.value === "number");
  const maxima = bands.slice(0, -1).map(band => {
    if (typeof band.max === "number") return band.max;
    const numbers = band.label.match(/\d+(?:\.\d+)?/g);
    return numbers && numbers.length >= 2 ? Number(numbers[numbers.length - 1]) : NaN;
  });
  const ranges = maxima.every((value, index) => Number.isFinite(value) && (index === 0 || value >= maxima[index - 1]!));
  const codes = layer.product_key === "flood_extent" || layer.product_key === "flood_hazard_zonation";
  if (!explicit && !ranges && !codes) throw new Error("Recorded legend has no explicit class codes or numerical breaks; display unavailable.");
  const rgba = new Uint8ClampedArray(values.length * 4);
  let minimum = Infinity, maximum = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (!Number.isFinite(value) || value === nodata) continue;
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
    const band = explicit ? bands.find(band => band.value === value) : codes ? bands[layer.product_key === "flood_extent" ? value : value - 1] : bands[maxima.findIndex(maximum => value <= maximum) === -1 ? bands.length - 1 : maxima.findIndex(maximum => value <= maximum)];
    if (!band) throw new Error("Raster value is outside the recorded product legend; display unavailable.");
    rgba.set([parseInt(band.color.slice(1,3),16), parseInt(band.color.slice(3,5),16), parseInt(band.color.slice(5,7),16), 255], i * 4);
  }
  if (minimum === Infinity) throw new Error("Raster contains no displayable cells.");
  return { rgba, minimum, maximum };
}
// Nearest-neighbour display reprojection preserves categorical colours and nodata.
export function reprojectRaster(raster: RasterData, displayBounds: Bounds): RasterData {
  if (!raster.crs) throw new Error("Raster source CRS unavailable.");
  const projection = sourceProjection(raster.crs);
  const transform = proj4("EPSG:4326", projection);
  const rgba = new Uint8ClampedArray(raster.rgba.length);
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    const longitude = displayBounds.west + (x + .5) / raster.width * (displayBounds.east - displayBounds.west);
    const latitude = displayBounds.north - (y + .5) / raster.height * (displayBounds.north - displayBounds.south);
    const [sx, sy] = transform.forward([longitude, latitude]);
    const column = Math.floor((sx! - raster.bounds.west) / (raster.bounds.east - raster.bounds.west) * raster.width);
    const row = Math.floor((raster.bounds.north - sy!) / (raster.bounds.north - raster.bounds.south) * raster.height);
    if (column >= 0 && row >= 0 && column < raster.width && row < raster.height) rgba.set(raster.rgba.subarray((row * raster.width + column) * 4, (row * raster.width + column) * 4 + 4), (y * raster.width + x) * 4);
  }
  return { ...raster, rgba, bounds: displayBounds, crs: "EPSG:4326" };
}
export function reprojectVector(vector: GeoJsonFeatureCollection, crs: string): GeoJsonFeatureCollection {
  const projection = sourceProjection(crs);
  function coordinates(value: unknown): unknown {
    if (!Array.isArray(value)) throw new Error("Invalid vector coordinates.");
    if (typeof value[0] === "number") return proj4(projection, "EPSG:4326", value as number[]);
    return value.map(coordinates);
  }
  return { ...vector, features: vector.features.map(feature => ({ ...feature, geometry: { ...feature.geometry, coordinates: coordinates(feature.geometry.coordinates) } as typeof feature.geometry })) };
}

export function styleDeliveredVector(vector: GeoJsonFeatureCollection, layer: ResultLayer): GeoJsonFeatureCollection {
  const field = layer.product_key === "flood_vulnerability" ? "fvi_index" : "value";
  const features = vector.features.map(feature => {
    const value = feature.properties?.[field];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Vector lacks a delivered numerical spatial-unit score.");
    const { rgba } = colorizeDelivered([value], null, layer);
    const color = "#" + Array.from(rgba.slice(0, 3)).map(channel => channel.toString(16).padStart(2, "0")).join("");
    return { ...feature, properties: { ...feature.properties, __displayColor: color } };
  });
  if (!features.length) throw new Error("Vector contains no displayable features.");
  return { ...vector, features };
}
