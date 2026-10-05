import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuantitativeDelivery } from "./QuantitativeDelivery";
import type { components } from "../../shared/api/generated/nova-browser-api";

describe("authoritative quantitative delivery", () => {
  it("retains zero classes, all area units, denominator and classification basis without recomputation", () => {
    const row = { product_key: "flood_extent", class_value: 0, label: "not flooded", cells: 0, area_m2: 0, area_ha: 0, area_km2: 0, percent_of_valid: 0, denominator_area_m2: 12345.67, area_method: "backend method", classification_basis: "presentation only", evidence_ref: "artifacts.extent" };
    render(<QuantitativeDelivery analytics={{ schema_version: "1.0", class_areas: [row], series: [], limitations: ["Independent checks pending"] }} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("12345.67")).toBeInTheDocument();
    expect(within(table).getAllByText("0")).toHaveLength(6);
    for (const label of ["Area (m²)", "Area (ha)", "Area (km²)", "% of valid area", "presentation only", "artifacts.extent"]) expect(within(table).getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Independent checks pending")).toBeInTheDocument();
  });
  it("presents delivered histogram and observed periods with units, basis and evidence", () => {
    const series = [{ product_key: "depth", kind: "histogram", units: "m", points: [{ lower: 0, upper: 2, count: 12 }], basis: "display-only bins", evidence_refs: ["artifacts.depth"] }, { product_key: "flood_change", kind: "observed_time_series", units: "m2", points: [{ timestamp: "2026-01-01T00:00:00Z", value: 42 }, { timestamp: "2026-01-02T00:00:00Z", value: 0 }], basis: "observed, not forecast", evidence_refs: ["provenance.comparison"] }] as unknown as components["schemas"]["QuantitativeSeries"][];
    render(<QuantitativeDelivery analytics={{ schema_version: "1.0", series, limitations: [] }} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("2026-01-01T00:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("Count (cells)")).toBeInTheDocument();
    expect(screen.getByText("observed, not forecast")).toBeInTheDocument();
  });
  it("renders supplied product statistics with explicit units and unavailable values", () => {
    render(<QuantitativeDelivery analytics={null} products={{ depth: { units: "m", minimum: 0, maximum: 8.3, mean: null, area_statistics: { valid_area_m2: 91 } } }} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("8.3")).toBeInTheDocument();
    expect(within(table).getByText("area_statistics.valid_area_m2")).toBeInTheDocument();
    expect(within(table).getByText("m²")).toBeInTheDocument();
    expect(within(table).getByText(/Unavailable \/ not applicable/)).toBeInTheDocument();
  });
  it("states absent analytics explicitly", () => {
    render(<QuantitativeDelivery analytics={null} />);
    expect(screen.getByText(/no class-area evidence supplied/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
