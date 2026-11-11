import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { ResultOverview } from "./ResultOverview";

type Overview = components["schemas"]["ResultOverview"];

const overview: Overview = {
  headline: {
    text: "Model-classified flood candidates cover 5.34 km² (5.44% of the 97.73 km² valid analysed area) for target 2024-05-24 to 2024-05-26, compared with baseline 2022-08-28 to 2022-09-03 (end dates exclusive). Flood candidates are a model classification trained on SAR screening labels, not confirmed flood observations.",
    flood_candidate_area_km2: 5.339, percent_of_valid: 5.4367, valid_area_km2: 97.73, target_period: "2024-05-24 to 2024-05-26", baseline_period: "2022-08-28 to 2022-09-03",
  },
  area_accounting: {
    aoi_cells: 111556, valid_cells: 110889, excluded_cells: 667, valid_area_km2: 97.73, aoi_area_km2_estimate: 98.318, excluded_area_km2_estimate: 0.588,
    valid_pct_of_aoi: 99.402, flood_candidate_area_km2: 5.339, flood_candidate_pct_of_valid: 5.4367, flood_candidate_pct_of_aoi: 5.4304,
    missing_cells_by_band: [{ band: "sar_change", cells: 667, pct_of_aoi: 0.598, affects_admission: true }, { band: "optical_reference", cells: 1500, pct_of_aoi: 1.3446, affects_admission: false }],
    method_note: "AOI and excluded areas are estimated as cell counts × mean valid-cell area; a cell can be missing in several bands, so band counts overlap and do not add up.",
  },
  quality_gates: [
    { name: "Valid pixel coverage", threshold: "≥ 70%", observed: "99.40%", status: "pass" },
    { name: "Sentinel-1 relative orbit match", threshold: "one orbit, same in both periods", observed: null, status: "not_recorded" },
    { name: "Independent reference", threshold: "compliant Sentinel-2 at both dates; ≥ 50 eligible pixels per class", observed: "not assessable: no compliant optical scene", status: "not_applicable" },
    { name: "Daily rainfall completeness", threshold: "every day of the target window", observed: "1 of 2 days", status: "fail" },
  ],
  data_sources: [{ dataset: "COPERNICUS/S1_GRD", role: "SAR backscatter, target and baseline", resolution: "10 m (IW GRD)", scene_dates: ["2022-08-28", "2024-05-25"], credit: "Contains modified Copernicus Sentinel data 2022, 2024" }],
  limitations: ["Independent accuracy: not assessable — Sentinel-2 baseline: No compliant optical scene", "Metrics describe supplied paired observations only."],
};

describe("Result overview (2.3)", () => {
  it("renders headline, area accounting, quality gates, data sources and limitations in one column, in that order", () => {
    render(<ResultOverview overview={overview} />);
    const container = screen.getByRole("region", { name: "Result overview" });
    const headings = within(container).getAllByRole("heading").map(item => item.textContent);
    expect(headings).toEqual(["What this result shows", "Area accounting", "Quality gates", "Data sources", "Limitations"]);
    const sections = Array.from(container.children).map(child => child.getAttribute("data-section"));
    expect(sections).toEqual(["headline", "area", "gates", "sources", "limitations"]);
    expect(container.className).toContain("result-overview");
    expect(screen.getByText(overview.headline.text)).toBeInTheDocument();
  });

  it("formats area accounting with units and states the method", () => {
    render(<ResultOverview overview={overview} />);
    const area = screen.getByRole("region", { name: "Area accounting" });
    expect(within(area).getByText("Valid analysed area").nextElementSibling).toHaveTextContent("97.73 km² (99.40% of AOI)");
    expect(within(area).getByText("AOI area (estimate)").nextElementSibling).toHaveTextContent("98.32 km² · 111,556 cells");
    expect(within(area).getByText("Excluded (no valid data)").nextElementSibling).toHaveTextContent("0.59 km² · 667 cells");
    expect(within(area).getByText("Flood candidates").nextElementSibling).toHaveTextContent("5.34 km² · 5.44% of valid · 5.43% of AOI");
    const table = within(area).getByRole("table", { name: /Missing cells by band/ });
    expect(within(table).getByText("optical_reference").closest("tr")).toHaveTextContent("1,5001.34%No (reference only)");
    expect(within(area).getByText(overview.area_accounting.method_note)).toBeInTheDocument();
  });

  it("shows each quality gate with threshold, observed value and a readable status", () => {
    render(<ResultOverview overview={overview} />);
    const table = screen.getByRole("table", { name: "Quality gates" });
    const row = (name: string) => within(table).getByText(name).closest("tr")!;
    expect(row("Valid pixel coverage")).toHaveTextContent("≥ 70%99.40%Pass");
    expect(row("Sentinel-1 relative orbit match")).toHaveTextContent("Not recorded");
    expect(row("Independent reference")).toHaveTextContent("Not applicable");
    expect(row("Daily rainfall completeness")).toHaveTextContent("Fail");
  });

  it("lists data sources with dates, resolution and credit, and limitations in the given order", () => {
    render(<ResultOverview overview={overview} />);
    const sources = screen.getByRole("table", { name: "Data sources" });
    expect(within(sources).getByText("2022-08-28, 2024-05-25")).toBeInTheDocument();
    expect(within(sources).getByText("Contains modified Copernicus Sentinel data 2022, 2024")).toBeInTheDocument();
    const items = within(screen.getByRole("region", { name: "Limitations" })).getAllByRole("listitem").map(item => item.textContent);
    expect(items).toEqual(overview.limitations);
  });
});

describe("Single-column result layout (client decision D4)", () => {
  const css = readFileSync(resolve(__dirname, "../../styles.css"), "utf8");
  const block = css.slice(css.indexOf("/* D4 single-column results layout"));
  it("is scoped to the result workspace and removes right-aligned and side-by-side text", () => {
    expect(block.length).toBeGreaterThan(0);
    for (const selector of [".product-delivery__heading", ".export-row", ".export-card", ".gis-pane > header"]) {
      expect(block).toMatch(new RegExp(`\\.result-workspace ${selector.replace(/[.>]/g, m => `\\${m}`)}[^{]*\\{[^}]*justify-content: flex-start`));
    }
    for (const selector of [".metadata-columns", ".export-groups", ".result-exploration", ".gis-pane-facts", ".result-summary"]) {
      expect(block).toContain(`.result-workspace ${selector}`);
    }
    expect(block).toMatch(/\.result-workspace \.metadata-list > div \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(block).not.toMatch(/\.gis-viewer|\.viewer-layout/);
    for (const line of block.split("\n").filter(text => text.includes("{"))) expect(line.trim().startsWith(".result-workspace") || line.trim().startsWith("/*") || line.trim().startsWith("@media")).toBe(true);
  });
});
