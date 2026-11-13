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

describe("curated deliverable groups (2.5)", () => {
  const grouped = (key: string, group: NonNullable<ResultArtifact["deliverable_group"]>, format = "pdf") => ({ ...item(key, format, "report"), deliverable_group: group });
  it("puts client deliverables first, then GIS data, figures and audit, with human labels", () => {
    const groups = groupResultExports([
      grouped("provenance", "audit", "json"), grouped("figure_roc", "figures", "png"), grouped("flood_extent_cog", "gis_data", "cog"),
      grouped("scientific_report_pdf", "client_deliverable"), grouped("flood_extent_map_png", "client_deliverable", "png"),
    ]);
    expect(groups.map((group) => group.key)).toEqual(["client_deliverable", "gis_data", "figures", "audit"]);
    expect(groups.map((group) => group.label)).toEqual(["Client deliverables", "GIS data", "Figures and accuracy tables", "Audit and provenance"]);
    expect(groups[0]!.artifacts.map((artifact) => artifact.key)).toEqual(["scientific_report_pdf", "flood_extent_map_png"]);
  });
  it("orders client deliverables: report first, then maps, then statistics and the package", () => {
    const groups = groupResultExports([
      grouped("report_package", "client_deliverable", "zip"), grouped("firris_excel_report", "client_deliverable", "xlsx"),
      grouped("flood_extent_map_pdf", "client_deliverable"), grouped("scientific_report_word", "client_deliverable", "docx"),
      grouped("scientific_report_pdf", "client_deliverable"),
    ]);
    expect(groups[0]!.artifacts.map((artifact) => artifact.key)).toEqual(["scientific_report_pdf", "scientific_report_word", "flood_extent_map_pdf", "firris_excel_report", "report_package"]);
  });
  it("falls back to the format-based groups when the API sends no deliverable group", () => {
    expect(groupResultExports([item("report", "pdf", "report")]).map((group) => group.key)).toEqual(["reports"]);
  });
});
