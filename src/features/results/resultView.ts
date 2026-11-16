// Presentation helpers for the refreshed result pages (UI refresh P4). Everything is derived from the API response;
// nothing is invented. Dates shown to people are inclusive; the API keeps exclusive ends.
import type { components } from "../../shared/api/generated/nova-browser-api";
import { formatPeriod, toLastDay } from "../analyses/periods";
import type { ResultArtifact } from "./gisViewer";

type Result = components["schemas"]["ResultResponse"];
type Dashboard = components["schemas"]["ValidationDashboard"];
type Scope = components["schemas"]["AccuracyScope"];

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const asString = (value: unknown): string | null => typeof value === "string" && value ? value : null;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** An API window {start, end (exclusive)} or "start to end" → "24–25 May 2024" (inclusive). */
export function inclusiveWindow(value: unknown): string | null {
  const record = asRecord(value);
  let start = asString(record?.start);
  let end = asString(record?.end);
  if (!record && typeof value === "string") [start, end] = value.split(" to ").map((part) => part.trim()) as [string, string];
  if (!start || !end || !ISO_DAY.test(start) || !ISO_DAY.test(end)) return null;
  return formatPeriod({ start, lastDay: toLastDay(end) });
}

export function resultPeriods(result: Pick<Result, "provenance" | "overview">) {
  const provenance = asRecord(result.provenance);
  return {
    target: inclusiveWindow(provenance?.target_period) ?? inclusiveWindow(result.overview?.headline.target_period ?? null),
    baseline: inclusiveWindow(provenance?.baseline_period) ?? inclusiveWindow(result.overview?.headline.baseline_period ?? null),
  };
}

type Scene = { acquired_at?: string; relative_orbit?: number; pass?: string; tile?: string; cloud_pct?: number; degraded_msi_pct?: number };
export function scenes(provenance: Record<string, unknown> | null, key: string): Scene[] {
  const lineage = asRecord(asRecord(provenance?.per_scene_lineage)?.[key]);
  return Array.isArray(lineage?.scenes) ? lineage.scenes.filter((item): item is Scene => asRecord(item) !== null) : [];
}

/** "Sentinel-1 VV ascending, orbit 57" from the scene lineage, when recorded. */
export function radarSummary(provenance: Record<string, unknown> | null): string | null {
  const all = [...scenes(provenance, "sentinel_1_target"), ...scenes(provenance, "sentinel_1_baseline")];
  if (!all.length) return null;
  const orbits = [...new Set(all.map((scene) => scene.relative_orbit).filter((orbit) => orbit != null))];
  const passes = [...new Set(all.map((scene) => scene.pass?.toLowerCase()).filter(Boolean))];
  return `Sentinel-1 VV${passes.length === 1 ? ` ${passes[0]}` : ""}${orbits.length ? `, orbit ${orbits.join(" / ")}` : ""}`;
}

export function resolutionMetres(provenance: Record<string, unknown> | null): number | null {
  const scale = asRecord(provenance?.projection_normalization)?.scale_m;
  return typeof scale === "number" ? scale : null;
}

/** Backlog §4.7 item 8: a display label that keeps the id. */
export function scienceVersionLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  const match = /-science-(\d+)$/.exec(id);
  return match ? `Science version ${match[1]} (id: ${id})` : id;
}

const MODEL_NAMES: Record<string, string> = { "firris-random-forest-baseline": "Random Forest baseline" };
export function modelLabel(id: string | null | undefined, version?: string | null): string | null {
  if (!id) return null;
  const name = MODEL_NAMES[id];
  const versioned = version ? `, version ${version}` : "";
  return name ? `${name}${versioned} (id: ${id})` : `${id}${versioned}`;
}

/** Sizes in binary units, as everywhere else in FRRIS (backlog §4.7 item 3). */
export function formatSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

// Independent accuracy is map accuracy only when it was assessed against the independent reference.
export function independentScope(dashboard: Dashboard | null | undefined): Scope | null {
  const assessment = dashboard?.accuracy_assessment;
  if (!assessment || assessment.independent_status !== "assessed") return null;
  return assessment.scopes.find((scope) => scope.scope === "independent_optical") ?? null;
}
export function internalScopes(dashboard: Dashboard | null | undefined): Scope[] {
  return (dashboard?.accuracy_assessment?.scopes ?? []).filter((scope) => scope.scope !== "independent_optical");
}

export const INDEPENDENT_STATUS_TEXT: Record<string, string> = {
  assessed: "assessed", not_assessable: "not assessable", insufficient_reference_samples: "insufficient reference samples", not_performed: "not performed",
};

export const fixed = (value: number | null | undefined, digits: number) => value === null || value === undefined || !Number.isFinite(value) ? null : value.toFixed(digits);
export const COUNT = new Intl.NumberFormat("en-GB");

export function confusionCells(scope: Scope) {
  const matrix = scope.confusion_matrix;
  const flood = matrix.classified["1"]!;
  const other = matrix.classified["0"]!;
  return {
    tp: flood.reference_1, fp: flood.reference_0, fn: other.reference_1, tn: other.reference_0,
    modelFlood: flood.total, modelOther: other.total,
    referenceFlood: matrix.reference_totals["1"]!, referenceOther: matrix.reference_totals["0"]!, all: matrix.reference_totals.all!,
    usersFlood: flood.users_accuracy, usersOther: other.users_accuracy,
    producersFlood: matrix.producers_accuracy["1"]!, producersOther: matrix.producers_accuracy["0"]!,
  };
}

// Downloads (P4): the API's deliverable_group, split into the groups people look for.
export type DownloadGroupKey = "reports" | "maps" | "rasters" | "vectors" | "layers" | "figures" | "audit";
export const DOWNLOAD_GROUPS: readonly { key: DownloadGroupKey; title: string; description: string; collapsed?: boolean }[] = [
  { key: "reports", title: "Reports", description: "Scientific report and the analysis workbook." },
  { key: "maps", title: "Framed maps", description: "Map only, with coordinate frame and legend. Add title, north arrow and scale bar in GIS." },
  { key: "rasters", title: "GIS rasters", description: "Native rasters for desktop and web GIS." },
  { key: "vectors", title: "GIS vectors", description: "Flood-candidate polygons." },
  { key: "layers", title: "GIS-ready styled layers", description: "Image + world file + QGIS and ArcGIS style files; opens styled in one step." },
  { key: "figures", title: "Figures and accuracy tables", description: "Publication figures (PNG 300 dpi, SVG) and accuracy tables as CSV.", collapsed: true },
  { key: "audit", title: "Audit and provenance", description: "Audit appendix, sample points, validation rasters, quality, model and lineage records.", collapsed: true },
];
const VECTOR_DELIVERY = new Set(["gpkg", "kml", "shapefile_zip", "vector", "geojson"]);

export function downloadGroup(artifact: ResultArtifact): DownloadGroupKey | "package" | null {
  if (!artifact.deliverable_group) return null;
  if (artifact.key === "report_package" || artifact.artifact_type === "package") return "package";
  if (artifact.delivery_type === "map_png" || artifact.delivery_type === "map_pdf") return "maps";
  if (artifact.deliverable_group === "client_deliverable") return "reports";
  if (artifact.deliverable_group === "gis_data") {
    if (artifact.delivery_type === "gis_layer_zip") return "layers";
    if (artifact.artifact_type === "vector" || VECTOR_DELIVERY.has(artifact.delivery_type)) return "vectors";
    return "rasters";
  }
  return artifact.deliverable_group === "figures" ? "figures" : "audit";
}

const REPORT_RANK = (artifact: ResultArtifact) => artifact.key.startsWith("scientific_report_pdf") ? 0 : artifact.key.startsWith("scientific_report") ? 1 : 2;
export function groupDownloads(artifacts: readonly ResultArtifact[]) {
  const groups = new Map<DownloadGroupKey, ResultArtifact[]>();
  let fullPackage: ResultArtifact | null = null;
  for (const artifact of artifacts) {
    const key = downloadGroup(artifact);
    if (key === "package") { fullPackage = artifact; continue; }
    if (key) groups.set(key, [...(groups.get(key) ?? []), artifact]);
  }
  const reports = groups.get("reports");
  if (reports) groups.set("reports", [...reports].sort((a, b) => REPORT_RANK(a) - REPORT_RANK(b)));
  return {
    curated: artifacts.length > 0 && artifacts.every((artifact) => artifact.deliverable_group),
    fullPackage,
    groups: DOWNLOAD_GROUPS.map((group) => ({ ...group, artifacts: groups.get(group.key) ?? [] })).filter((group) => group.artifacts.length),
  };
}

const FORMAT_NAMES: Record<string, string> = {
  pdf: "PDF", docx: "Word", xlsx: "Excel", excel: "Excel", png: "PNG", svg: "SVG", csv: "CSV", json: "JSON", zip: "ZIP",
  geotiff: "GeoTIFF", cog: "COG", geojson: "GeoJSON", gpkg: "GeoPackage", kml: "KML", shapefile_zip: "Shapefile",
};
export const formatName = (artifact: ResultArtifact) => FORMAT_NAMES[artifact.format.toLowerCase()] ?? artifact.format.toUpperCase();

const DELIVERY_NOTES: Record<string, string> = {
  map_png: "300 dpi image", map_pdf: "Vector print version", cog: "Cloud-optimised, for web GIS", geotiff: "For desktop GIS",
  gpkg: "For QGIS / ArcGIS", kml: "For Google Earth", shapefile_zip: "For older GIS software", gis_layer_zip: "PNG + world file + .qml / .lyrx",
  docx: "Editable", excel: "Area statistics, accuracy tables and quality gates",
};
export const deliveryNote = (artifact: ResultArtifact) => DELIVERY_NOTES[artifact.delivery_type] ?? DELIVERY_NOTES[artifact.format] ?? null;

/** The framed map PNGs from the result package, extent first. */
export function framedMaps(artifacts: readonly ResultArtifact[]) {
  return artifacts.filter((artifact) => artifact.delivery_type === "map_png")
    .sort((a, b) => Number(b.product_key === "flood_extent") - Number(a.product_key === "flood_extent"));
}

/** A figure PNG from the package for one scope ("roc" or "pr"). */
export function figure(artifacts: readonly ResultArtifact[], scope: string, kind: "roc" | "pr") {
  return artifacts.find((artifact) => artifact.key === `figure_${scope}_${kind}_png`) ?? null;
}
