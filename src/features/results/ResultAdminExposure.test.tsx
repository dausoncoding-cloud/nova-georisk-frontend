import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResultArtifact } from "./gisViewer";
import { chartBars, ResultAdminExposure, unitLines } from "./ResultAdminExposure";

const extents = [{ key: "whole_area", label: "Whole area (reference)" }, { key: "observed_extent", label: "Observed flood candidates (this run)" },
  { key: "rp100", label: "Modelled 1-in-100-year zone" }];
const cell = (people: number, buildings: number | null) => ({ people, buildings, buildings_065: buildings === null ? null : buildings + 1 });
const districts = Array.from({ length: 17 }, (_, i) => ({
  unit_id: `D${i}`, name: `District ${String(i).padStart(2, "0")}`, parent: "Pwani", share_of_unit_in_aoi: i === 0 ? 1 : 0.25,
  extents: { whole_area: cell(1000 + i, 100), observed_extent: cell(100 + i * 10, 10 + i), rp100: cell(50, null) },
}));
const outside = { unit_id: "_outside", name: "Outside any unit", parent: null, share_of_unit_in_aoi: null,
  extents: { whole_area: cell(3, 0), observed_extent: cell(1, 0), rp100: cell(0, null) } };
const prov = { dataset: "geoBoundaries", release_type: "gbOpen", boundaryID: "TZA-ADM2-72390352", source: "NBS / UN OCHA ROSA", year_represented: "2021", licence: "CC BY 3.0 IGO" };
const observedPeople = districts.reduce((sum, d) => sum + d.extents.observed_extent.people, 0) + 1;
const observedBuildings = districts.reduce((sum, d) => sum + (d.extents.observed_extent.buildings ?? 0), 0);
const record = {
  status: "assessed",
  by_admin_unit: {
    status: "assessed", extents,
    levels: [
      { level: "L1", level_name: "Region", status: "assessed", provenance: prov, rows: [{ unit_id: "region:Pwani", name: "Pwani", parent: null, share_of_unit_in_aoi: 0.01,
        extents: { observed_extent: cell(observedPeople, observedBuildings), whole_area: cell(1, 1), rp100: cell(1, null) } }],
        check: { ok: true, extents: { observed_extent: { people_total: observedPeople, buildings_total: observedBuildings, buildings_ok: true } } } },
      { level: "L2", level_name: "District", status: "assessed", provenance: prov, rows: [...districts, outside],
        buildings_note: "Buildings are counted per unit for the observed extent and the 1-in-100-year zone only.",
        check: { ok: true, extents: { observed_extent: { people_total: observedPeople, buildings_total: observedBuildings, buildings_ok: true } } } },
      { level: "L3", level_name: "Ward", status: "not_provided", reason: "Ward boundaries not yet provided" },
    ],
  },
};
const artifacts = [{ key: "flood_exposure_by_admin_unit_csv", label: "CSV" }, { key: "exposure_by_admin_unit_gpkg", label: "GeoPackage" }] as unknown as ResultArtifact[];

describe("exposure by administrative unit", () => {
  it("sorts units by people and groups the rest as Other units after the top 15", () => {
    const lines = unitLines(record.by_admin_unit.levels[1] as Record<string, unknown>, "observed_extent");
    expect(lines[0]?.name).toBe("District 16");
    expect(lines.at(-1)?.name).toBe("Outside any unit");
    const bars = chartBars(lines);
    expect(bars.map((bar) => bar.name).slice(14)).toEqual(["District 02", "Other units (2)", "Outside any unit"]);
    expect(bars.reduce((sum, bar) => sum + (bar.cell.people ?? 0), 0)).toBe(observedPeople);
    expect(chartBars(unitLines(record.by_admin_unit.levels[1] as Record<string, unknown>, "rp100")).find((bar) => bar.other)?.cell.buildings).toBeNull();
  });

  it("opens on districts with the chart, the full table, the sum check, sources and downloads", () => {
    render(<ResultAdminExposure record={record} resultId="r1" artifacts={artifacts} />);
    expect(screen.getByRole("button", { name: "Districts" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Estimated people by district: Observed flood candidates (this run)" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 17 + 1 + 1);
    expect(within(table).getByRole("rowheader", { name: "District 16" }).closest("tr")).toHaveTextContent("Pwani25.0%26026 (27)");
    expect(within(table).getByRole("rowheader", { name: "District 00" }).closest("tr")).toHaveTextContent("100%");
    expect(within(table).getByRole("rowheader", { name: "Total (the area totals)" }).closest("tr")).toHaveTextContent(`${observedPeople.toLocaleString("en-GB")}${observedBuildings}`);
    expect(observedPeople).toBe(3061);
    expect(screen.getByText(`Units add up to the area total: ${observedPeople.toLocaleString("en-GB")} people, ${observedBuildings} buildings.`, { exact: false })).toHaveTextContent("TZA-ADM2-72390352");
    expect(screen.getByText(/counted per unit for the observed extent/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download the table (CSV)" })).toHaveAttribute("href", "/api/v1/results/r1/products/flood_exposure_by_admin_unit_csv");
    expect(screen.getByRole("link", { name: /GeoPackage/ })).toHaveAttribute("href", "/api/v1/results/r1/products/exposure_by_admin_unit_gpkg");
    expect(screen.getAllByText(/not people affected/).length).toBeGreaterThan(0);
  });

  it("switches extent and level; wards say they are not yet provided", () => {
    render(<ResultAdminExposure record={record} resultId="r1" artifacts={[]} />);
    fireEvent.change(screen.getByLabelText("Extent"), { target: { value: "rp100" } });
    expect(screen.getByRole("img", { name: "Estimated people by district: Modelled 1-in-100-year zone" })).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByText("not counted").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Regions" }));
    expect(within(screen.getByRole("table")).getAllByRole("columnheader", { name: "Region" })).toHaveLength(1);  // the level column only
    fireEvent.click(screen.getByRole("button", { name: "Wards" }));
    expect(screen.getByRole("status")).toHaveTextContent("Wards: Ward boundaries not yet provided");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
