import type { GeoJsonGeometry } from "./geometry";

export const AOI_UPLOAD_LIMIT = 20 * 1024 * 1024;

type FeatureLike = {
  type?: string;
  geometry?: unknown;
  features?: unknown[];
  coordinates?: unknown;
};

function asPolygonGeometry(value: unknown): GeoJsonGeometry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as FeatureLike;
  if (candidate.type === "Polygon" || candidate.type === "MultiPolygon") {
    return { type: candidate.type, coordinates: candidate.coordinates as unknown[] };
  }
  if (candidate.type === "Feature") return asPolygonGeometry(candidate.geometry);
  return null;
}

export function normalizeGeoJson(value: unknown): { geometry: GeoJsonGeometry; featureCount: number } {
  if (!value || typeof value !== "object") throw new Error("The file does not contain a GeoJSON object.");
  const candidate = value as FeatureLike;
  if (candidate.type !== "FeatureCollection") {
    const geometry = asPolygonGeometry(candidate);
    if (!geometry) throw new Error("Only Polygon and MultiPolygon AOIs are supported.");
    return { geometry, featureCount: 1 };
  }
  const geometries = (candidate.features ?? []).map(asPolygonGeometry).filter((item): item is GeoJsonGeometry => Boolean(item));
  if (geometries.length === 0) throw new Error("No polygon features were found.");
  if (geometries.length !== candidate.features?.length) throw new Error("Every feature must be a Polygon or MultiPolygon.");
  const polygons = geometries.flatMap((geometry) => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);
  return { geometry: { type: "MultiPolygon", coordinates: polygons }, featureCount: geometries.length };
}

export async function parseGeoJsonFile(file: File) {
  if (file.size > AOI_UPLOAD_LIMIT) throw new Error("AOI files must be 20 MB or smaller.");
  return normalizeGeoJson(JSON.parse(await file.text()));
}

export function validateShapefileEntries(entries: string[]): { hasProjection: boolean } {
  if (entries.some((name) => name.startsWith("/") || name.includes("..") || /^[A-Za-z]:/.test(name))) {
    throw new Error("The archive contains an unsafe path.");
  }
  const basenames = entries.map((name) => name.replaceAll("\\", "/").split("/").pop()?.toLowerCase() ?? "");
  const stems = basenames.filter((name) => name.endsWith(".shp")).map((name) => name.slice(0, -4));
  if (stems.length !== 1) throw new Error("A Shapefile ZIP must contain exactly one .shp file.");
  const stem = stems[0];
  for (const extension of [".shx", ".dbf"]) {
    if (!basenames.includes(`${stem}${extension}`)) throw new Error(`The archive is missing ${stem}${extension}.`);
  }
  return { hasProjection: basenames.includes(`${stem}.prj`) };
}

export function readZipEntryNames(buffer: ArrayBuffer): string[] {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const entries: string[] = [];
  for (let offset = 0; offset <= view.byteLength - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push(decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)));
    offset += 45 + nameLength + extraLength + commentLength;
  }
  if (entries.length === 0) throw new Error("The selected file is not a readable ZIP archive.");
  return entries;
}

export async function parseShapefilePreview(file: File) {
  if (file.size > AOI_UPLOAD_LIMIT) throw new Error("Shapefile ZIPs must be 20 MB or smaller.");
  const buffer = await file.arrayBuffer();
  const validation = validateShapefileEntries(readZipEntryNames(buffer));
  const { default: parseShapefile } = await import("shpjs");
  const parsed = await parseShapefile(buffer);
  const collections = Array.isArray(parsed) ? parsed : [parsed];
  const merged = { type: "FeatureCollection", features: collections.flatMap((collection) => collection.features) };
  return { ...normalizeGeoJson(merged), hasProjection: validation.hasProjection };
}

type Point = [number, number];

function cross(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsTouch(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  const on = (p: Point, q: Point, r: Point) =>
    Math.abs(cross(p, q, r)) < 1e-12
    && r[0] >= Math.min(p[0], q[0]) && r[0] <= Math.max(p[0], q[0])
    && r[1] >= Math.min(p[1], q[1]) && r[1] <= Math.max(p[1], q[1]);
  return (Math.abs(abC) < 1e-12 && on(a, b, c))
    || (Math.abs(abD) < 1e-12 && on(a, b, d))
    || (Math.abs(cdA) < 1e-12 && on(c, d, a))
    || (Math.abs(cdB) < 1e-12 && on(c, d, b));
}

function ringsTouch(first: Point[], second: Point[]): boolean {
  for (let i = 0; i < first.length - 1; i += 1) {
    for (let j = 0; j < second.length - 1; j += 1) {
      if (segmentsTouch(first[i]!, first[i + 1]!, second[j]!, second[j + 1]!)) return true;
    }
  }
  return false;
}

function containsPoint(ring: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i, i += 1) {
    const a = ring[i]!;
    const b = ring[j]!;
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function validateKmlTopology(polygons: Point[][][]): void {
  for (const polygon of polygons) {
    const outer = polygon[0]!;
    for (const hole of polygon.slice(1)) {
      if (!containsPoint(outer, hole[0]!) || ringsTouch(outer, hole)) {
        throw new Error("KML interior rings must be wholly inside their polygon without touching its boundary.");
      }
    }
    for (let i = 1; i < polygon.length; i += 1) {
      for (let j = i + 1; j < polygon.length; j += 1) {
        if (ringsTouch(polygon[i]!, polygon[j]!) || containsPoint(polygon[i]!, polygon[j]![0]!)) {
          throw new Error("KML interior rings may not overlap or nest.");
        }
      }
    }
  }
  for (let i = 0; i < polygons.length; i += 1) {
    for (let j = i + 1; j < polygons.length; j += 1) {
      const first = polygons[i]![0]!;
      const second = polygons[j]![0]!;
      if (ringsTouch(first, second) || containsPoint(first, second[0]!) || containsPoint(second, first[0]!)) {
        throw new Error("KML multipart polygons may not overlap or touch.");
      }
    }
  }
}

export function parseKml(text: string): { geometry: GeoJsonGeometry; featureCount: number } {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The KML document is not valid XML.");
  const parseRing = (boundary: Element): Point[] => {
    const text = boundary.getElementsByTagName("coordinates")[0]?.textContent?.trim();
    if (!text) throw new Error("A KML polygon ring is missing coordinates.");
    const ring = text.split(/\s+/).map((tuple) => {
      const parts = tuple.split(",");
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        throw new Error("KML polygon coordinates must include longitude and latitude.");
      }
      return [Number(parts[0]), Number(parts[1])] as Point;
    });
    if (ring.length < 4 || ring.some(([x, y]) => x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y) || x < -180 || x > 180 || y < -90 || y > 90)) {
      throw new Error("KML polygon coordinates must be valid WGS84 longitude/latitude pairs.");
    }
    const first = ring[0]!; const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error("KML polygon rings must be closed.");
    if (new Set(ring.slice(0, -1).map(([x, y]) => `${x},${y}`)).size < 3) {
      throw new Error("KML polygon rings require three distinct vertices.");
    }
    for (let i = 0; i < ring.length - 1; i += 1) {
      for (let j = i + 2; j < ring.length - 1; j += 1) {
        if (i === 0 && j === ring.length - 2) continue;
        if (segmentsTouch(ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!)) {
          throw new Error("KML polygon rings may not self-intersect.");
        }
      }
    }
    return ring;
  };
  const polygons = [...document.getElementsByTagName("Polygon")].map((polygon) => {
    const exterior = polygon.getElementsByTagName("outerBoundaryIs")[0];
    if (!exterior) throw new Error("A KML polygon is missing its outer boundary.");
    const interiors = [...polygon.getElementsByTagName("innerBoundaryIs")].map(parseRing);
    return [parseRing(exterior), ...interiors];
  });
  if (polygons.length === 0) throw new Error("No polygon geometry was found in the KML file.");
  validateKmlTopology(polygons);
  return {
    geometry: polygons.length === 1
      ? { type: "Polygon", coordinates: polygons[0]! }
      : { type: "MultiPolygon", coordinates: polygons },
    featureCount: polygons.length,
  };
}

export function estimateGeometryStats(geometry: GeoJsonGeometry) {
  const earthRadius = 6_371_008.8;
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : geometry.coordinates as number[][][][];
  const ringStats = (points: number[][]) => {
    let perimeterM = 0;
    let area = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]!;
      const current = points[index]!;
      const lon1 = previous[0]! * Math.PI / 180;
      const lat1 = previous[1]! * Math.PI / 180;
      const lon2 = current[0]! * Math.PI / 180;
      const lat2 = current[1]! * Math.PI / 180;
      const a = Math.sin((lat2 - lat1) / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
      perimeterM += 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
      area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return { areaM2: Math.abs(area * earthRadius * earthRadius / 2), perimeterM };
  };
  let areaM2 = 0;
  let perimeterM = 0;
  for (const polygon of polygons) {
    polygon.forEach((ring, index) => {
      const stats = ringStats(ring);
      areaM2 += index === 0 ? stats.areaM2 : -stats.areaM2;
      perimeterM += stats.perimeterM;
    });
  }
  return { areaKm2: Math.max(0, areaM2) / 1_000_000, perimeterM };
}
