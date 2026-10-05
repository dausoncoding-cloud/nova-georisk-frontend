import type { GeoJsonGeometry } from "./geometry";

type Point = [number, number];

function polygonRings(geometry: GeoJsonGeometry): Point[][] {
  if (geometry.type === "Polygon") return geometry.coordinates as Point[][];
  return (geometry.coordinates as Point[][][]).flatMap((polygon) => polygon);
}

export function geometryToSvgPaths(
  geometry: GeoJsonGeometry,
  width = 320,
  height = 180,
  padding = 14,
): string[] {
  const rings = polygonRings(geometry);
  const points = rings.flat();
  if (points.length === 0) return [];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const west = Math.min(...xs);
  const east = Math.max(...xs);
  const south = Math.min(...ys);
  const north = Math.max(...ys);
  const spanX = Math.max(east - west, Number.EPSILON);
  const spanY = Math.max(north - south, Number.EPSILON);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const drawnWidth = spanX * scale;
  const drawnHeight = spanY * scale;
  const offsetX = (width - drawnWidth) / 2;
  const offsetY = (height - drawnHeight) / 2;

  return rings.map((ring) =>
    ring
      .map(([x, y], index) => {
        const px = offsetX + (x - west) * scale;
        const py = offsetY + (north - y) * scale;
        return `${index === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
      })
      .join(" ") + " Z",
  );
}

export function AoiGeometryPreview({
  geometry,
  crs,
  title = "AOI boundary",
}: {
  geometry: GeoJsonGeometry;
  crs: string;
  title?: string;
}) {
  const paths = geometryToSvgPaths(geometry);
  return (
    <figure className="aoi-preview">
      <svg role="img" aria-label={`${title} in ${crs}`} viewBox="0 0 320 180">
        <defs>
          <pattern id="aoi-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="320" height="180" className="aoi-preview__grid" />
        {paths.map((path, index) => (
          <path key={index} d={path} className="aoi-preview__shape" fillRule="evenodd" />
        ))}
      </svg>
      <figcaption><span>{title}</span><strong>{crs}</strong></figcaption>
    </figure>
  );
}
