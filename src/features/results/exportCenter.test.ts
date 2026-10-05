import { describe, expect, it } from "vitest";
import { groupResultExports } from "./exportGroups";
import type { ResultArtifact } from "./gisViewer";

function item(key: string, format: string, artifactType: ResultArtifact["artifact_type"]): ResultArtifact {
  return { key, label: key, url: key, media_type: "application/octet-stream", delivery_type: format, format, artifact_type: artifactType, role: "export", product_key: null, schema_version: "1.0", result_version: 1 };
}

describe("export center", () => {
  it("groups PDF, tables, GIS files, packages, and metadata", () => {
    const groups = groupResultExports([
      item("report", "pdf", "report"), item("samples", "csv", "report"),
      item("raster", "cog", "raster"), item("package", "zip", "package"),
      item("provenance", "json", "metadata"),
    ]);
    expect(Object.fromEntries(groups.map((group) => [group.key, group.artifacts.map((artifact) => artifact.key)]))).toEqual({
      reports: ["report"], tabular: ["samples"], gis: ["raster"], package: ["package"], metadata: ["provenance"],
    });
  });
});
