import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FIRRISGisViewer } from "./FIRRISGisViewer";
import type { ResultArtifact, ResultLayer } from "./gisViewer";

const layers = ["extent", "probability", "risk"].map((key) => ({
  key: `${key}_raster`, label: key, product_key: key === "extent" ? "flood_extent" : `flood_${key}`,
  layer_type: "raster", crs: "EPSG:4326", bounding_box: { west: 36, south: -2, east: 37, north: -1 },
  display_bounds_wgs84: { west: 36, south: -2, east: 37, north: -1 },
  renderable: true, rendering_reason: null, available_delivery_types: ["preview"], planned_delivery_types: [], artifact_keys: [`${key}_preview`],
})) as ResultLayer[];

const artifacts = ["extent", "probability", "risk"].map((key) => ({
  key: `${key}_preview`, label: key, url: key, media_type: "image/png", delivery_type: "preview", format: "png",
  artifact_type: "preview", role: "product", product_key: key, schema_version: "1.0", result_version: 1,
})) as ResultArtifact[];

describe("FIRRIS GIS viewer", () => {
  it("supports two-product comparison and enforces the visibility limit", () => {
    render(<FIRRISGisViewer resultId="result-one" layers={layers} artifacts={artifacts} aoi={null} />);
    const probability = screen.getByLabelText(/probability/i);
    fireEvent.click(probability);
    expect(screen.getByRole("heading", { name: "extent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "probability" })).toBeInTheDocument();
    expect(screen.getByLabelText(/risk/i)).toBeDisabled();
    expect(screen.getAllByText("Basemap")).toHaveLength(2);
    expect(screen.getByLabelText(/extent opacity/i)).toHaveAttribute("type", "range");
    expect(screen.getAllByText(/EPSG:4326/).length).toBeGreaterThan(0);
  });

  it("uses delivered product legend semantics instead of a generic placeholder", () => {
    const withLegend = [{ ...layers[0]!, legend: { title: "SAR-derived flood classification", entries: [{ label: "Classified flooded (1)", color: "#00BFFF" }] } } as unknown as ResultLayer];
    render(<FIRRISGisViewer resultId="result-one" layers={withLegend} artifacts={artifacts} aoi={null} />);
    expect(screen.getByText("SAR-derived flood classification")).toBeInTheDocument();
    expect(screen.getByText("Classified flooded (1)")).toBeInTheDocument();
  });
  it("shows normalized bounds, temporal metadata and explicit missing legend", () => {
    const layer = { ...layers[0]!, bounding_box: { west: 500000, south: 100000, east: 600000, north: 200000 }, crs: "EPSG:32636", temporal_metadata: { before_timestamp: "2026-01-01T00:00:00Z", observation_definition: "sourced binary flood observation" } } as unknown as ResultLayer;
    render(<FIRRISGisViewer resultId="result-one" layers={[layer]} artifacts={[]} aoi={null} />);
    expect(screen.getByText("36.0000, -2.0000 → 37.0000, -1.0000")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01T00:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("Product legend unavailable.")).toBeInTheDocument();
  });

});
