import type { ResultArtifact } from "./gisViewer";

export type ExportGroupKey = "reports" | "tabular" | "gis" | "package" | "metadata";
export type ExportGroup = { key: ExportGroupKey; label: string; description: string; artifacts: ResultArtifact[] };

const DEFINITIONS: Array<Omit<ExportGroup, "artifacts">> = [
  { key: "reports", label: "Reports", description: "Human-readable FIRRIS analysis reports." },
  { key: "tabular", label: "Tables and samples", description: "CSV and Excel data for review and downstream analysis." },
  { key: "gis", label: "GIS products", description: "Native raster and vector files for desktop GIS." },
  { key: "package", label: "Complete package", description: "The versioned result package with delivered products and reports." },
  { key: "metadata", label: "Metadata and provenance", description: "Machine-readable quality, model, validation, and lineage records." },
];

function category(artifact: ResultArtifact): ExportGroupKey {
  if (artifact.format === "zip" || artifact.artifact_type === "package") return "package";
  if (["geotiff", "cog", "geojson"].includes(artifact.format) || ["raster", "vector"].includes(artifact.artifact_type)) return "gis";
  if (["csv", "xlsx", "excel"].includes(artifact.format)) return "tabular";
  if (artifact.format === "pdf") return "reports";
  return "metadata";
}

export function groupResultExports(artifacts: ResultArtifact[]): ExportGroup[] {
  const buckets = new Map<ExportGroupKey, ResultArtifact[]>();
  artifacts.forEach((artifact) => buckets.set(category(artifact), [...(buckets.get(category(artifact)) ?? []), artifact]));
  return DEFINITIONS.map((definition) => ({ ...definition, artifacts: buckets.get(definition.key) ?? [] }))
    .filter((group) => group.artifacts.length > 0);
}
