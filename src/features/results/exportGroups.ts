import type { ResultArtifact } from "./gisViewer";

type CuratedKey = NonNullable<ResultArtifact["deliverable_group"]>;
type LegacyKey = "reports" | "tabular" | "gis" | "package" | "metadata";
export type ExportGroupKey = CuratedKey | LegacyKey;
export type ExportGroup = { key: ExportGroupKey; label: string; description: string; artifacts: ResultArtifact[] };

// Plan item 2.5: curated groups computed by the API, client deliverables first.
const CURATED: Array<Omit<ExportGroup, "artifacts">> = [
  { key: "client_deliverable", label: "Client deliverables", description: "Scientific report, framed maps, statistics workbook and the complete package." },
  { key: "gis_data", label: "GIS data", description: "Native rasters and vectors, GIS-ready map layers with QGIS/ArcGIS styles, and other GIS formats." },
  { key: "figures", label: "Figures and accuracy tables", description: "Publication figures (PNG 300 dpi, SVG) and accuracy tables as CSV." },
  { key: "audit", label: "Audit and provenance", description: "Audit appendix, quality, model, validation and lineage records." },
];

// Fallback for responses without deliverable_group (older API versions).
const LEGACY: Array<Omit<ExportGroup, "artifacts">> = [
  { key: "reports", label: "Reports", description: "Human-readable FIRRIS analysis reports." },
  { key: "tabular", label: "Tables and samples", description: "CSV and Excel data for review and downstream analysis." },
  { key: "gis", label: "GIS products", description: "Native raster and vector files for desktop GIS." },
  { key: "package", label: "Complete package", description: "The versioned result package with delivered products and reports." },
  { key: "metadata", label: "Metadata and provenance", description: "Machine-readable quality, model, validation, and lineage records." },
];

function legacyCategory(artifact: ResultArtifact): LegacyKey {
  if (artifact.format === "zip" || artifact.artifact_type === "package") return "package";
  if (["geotiff", "cog", "geojson"].includes(artifact.format) || ["raster", "vector"].includes(artifact.artifact_type)) return "gis";
  if (["csv", "xlsx", "excel"].includes(artifact.format)) return "tabular";
  if (artifact.format === "pdf") return "reports";
  return "metadata";
}

function clientRank(artifact: ResultArtifact): number {
  if (artifact.key.startsWith("scientific_report_pdf")) return 0;
  if (artifact.key.startsWith("scientific_report")) return 1;
  if (artifact.delivery_type === "map_pdf" || artifact.delivery_type === "map_png" || /_map_(pdf|png)$/.test(artifact.key)) return 2;
  if (artifact.key === "report_package") return 4;
  return 3;
}

export function groupResultExports(artifacts: ResultArtifact[]): ExportGroup[] {
  const curated = artifacts.length > 0 && artifacts.every((artifact) => artifact.deliverable_group);
  const definitions = curated ? CURATED : LEGACY;
  const key = (artifact: ResultArtifact): ExportGroupKey => (curated ? artifact.deliverable_group! : legacyCategory(artifact));
  const buckets = new Map<ExportGroupKey, ResultArtifact[]>();
  artifacts.forEach((artifact) => buckets.set(key(artifact), [...(buckets.get(key(artifact)) ?? []), artifact]));
  const client = buckets.get("client_deliverable");
  if (client) buckets.set("client_deliverable", [...client].sort((a, b) => clientRank(a) - clientRank(b)));
  return definitions.map((definition) => ({ ...definition, artifacts: buckets.get(definition.key) ?? [] }))
    .filter((group) => group.artifacts.length > 0);
}
