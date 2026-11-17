// UI refresh P4: Overview, Accuracy, Downloads and Provenance against a trimmed copy of a real FRRIS API response
// (Rufiji, May 2024, independent accuracy assessed; ids replaced). Kilombero is the same response marked not assessable.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import rufijiFixture from "./testdata/rufiji-result.json";
import { ResultDetailPage } from "./ResultDetailPage";
import { fetchResult } from "./resultsApi";
import { downloadGroup, formatSize, groupDownloads, inclusiveWindow, modelLabel, scienceVersionLabel } from "./resultView";
import type { ResultArtifact } from "./gisViewer";

vi.mock("./resultsApi", async (load) => ({ ...await load<typeof import("./resultsApi")>(), fetchResult: vi.fn() }));
vi.mock("../aois/aoisApi", async (load) => ({ ...await load<typeof import("../aois/aoisApi")>(), fetchAoi: vi.fn().mockResolvedValue({ id: "aoi", name: "Rufiji floodplain 2024", crs: "EPSG:4326", geometry: { type: "Polygon", coordinates: [] } }) }));
vi.mock("./FIRRISGisViewer", () => ({ FIRRISGisViewer: () => <div>Interactive map viewer</div> }));
vi.mock("../tasks/TaskArchive", () => ({ TaskArchive: () => <div>Execution archive content</div> }));

type Fixture = typeof rufijiFixture;
const rufiji = () => structuredClone(rufijiFixture) as Fixture;
const REASON = "Sentinel-2 target: Missing scene tiles: collection footprints do not cover AOI";
function kilombero() {
  const data = rufiji() as Fixture & Record<string, unknown>;
  const assessment = data.validation_dashboard.accuracy_assessment;
  Object.assign(assessment, { independent_status: "not_assessable", independent_reason: REASON, independent_wording: null });
  assessment.scopes = assessment.scopes.filter((scope) => scope.scope !== "independent_optical");
  data.validation_dashboard.independent_validation = "not_assessable";
  data.summary.independent_accuracy = { status: "not_assessable", reason: REASON, method: null, audit_sample: null } as never;
  data.exports = data.exports.filter((item) => !/independent_(optical|reference|accuracy)/.test(item.key));
  return data;
}

const ID = rufijiFixture.id;
const url = (key: string) => `/api/v1/results/${ID}/products/${key}`;

function setup(data: unknown, tab?: string) {
  vi.mocked(fetchResult).mockResolvedValue(data as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/results/${ID}${tab ? `?tab=${tab}` : ""}`]}><Routes><Route path="/results/:resultId" element={<ResultDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => vi.mocked(fetchResult).mockReset());

describe("result view helpers", () => {
  it("shows API windows inclusive", () => {
    expect(inclusiveWindow({ start: "2024-05-24", end: "2024-05-26" })).toBe("24–25 May 2024");
    expect(inclusiveWindow("2022-08-28 to 2022-09-03")).toBe("28 Aug – 2 Sep 2022");
    expect(inclusiveWindow({ start: "2024-05-24" })).toBeNull();
  });
  it("labels the science version and the model id while keeping the ids (backlog §4.7 item 8)", () => {
    expect(scienceVersionLabel("firris-science-2")).toBe("Science version 2 (id: firris-science-2)");
    expect(modelLabel("firris-random-forest-baseline", "1.0")).toBe("Random Forest baseline, version 1.0 (id: firris-random-forest-baseline)");
    expect(modelLabel("other-model", null)).toBe("other-model");
  });
  it("uses binary units", () => {
    expect(formatSize(654764)).toBe("639.4 KiB");
    expect(formatSize(13937425)).toBe("13.3 MiB");
    expect(formatSize(null)).toBeNull();
  });
  it("splits the API deliverable groups into reports, maps, rasters, vectors, layers, figures and audit", () => {
    const all = [...rufijiFixture.products, ...rufijiFixture.exports] as ResultArtifact[];
    const { groups, fullPackage, curated } = groupDownloads(all);
    expect(curated).toBe(true);
    expect(fullPackage?.key).toBe("report_package");
    expect(groups.map((group) => group.key)).toEqual(["reports", "maps", "rasters", "vectors", "layers", "figures", "audit"]);
    const keys = (key: string) => groups.find((group) => group.key === key)!.artifacts.map((item) => item.key);
    expect(keys("reports")).toEqual(["scientific_report_pdf", "scientific_report_word", "firris_excel_report"]);
    expect(keys("maps")).toEqual(expect.arrayContaining(["flood_extent_map_png", "flood_extent_map_pdf", "flood_probability_map_png", "flood_probability_map_pdf"]));
    expect(keys("rasters")).toEqual(["flood_extent_cog", "flood_extent_geotiff", "flood_probability_cog", "flood_probability_geotiff"]);
    expect(keys("vectors")).toEqual(expect.arrayContaining(["flood_extent_vector", "flood_extent_vector_gpkg", "flood_extent_vector_kml", "flood_extent_vector_shapefile_zip"]));
    expect(keys("layers")).toEqual(["flood_extent_gis_layer", "flood_probability_gis_layer"]);
    expect(groups.reduce((total, group) => total + group.artifacts.length, 1)).toBe(all.length); // + the package: nothing is dropped
    expect(downloadGroup({ ...all[0]!, deliverable_group: null })).toBeNull();
  });
});

describe("Overview", () => {
  it("shows key figures, the framed map with an extent/confidence switch, the API summary and inclusive dates", async () => {
    setup(rufiji());
    expect(await screen.findByRole("heading", { level: 1, name: "Rufiji floodplain 2024" })).toBeInTheDocument();
    expect(screen.getByText("Target 24–25 May 2024 · Baseline 28 Aug – 2 Sep 2022 · Sentinel-1 VV ascending, orbit 57 · 30 m")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report (PDF)" })).toHaveAttribute("href", url("scientific_report_pdf"));
    expect(screen.getByRole("link", { name: "Report (Word)" })).toHaveAttribute("href", url("scientific_report_word"));
    const figures = screen.getByRole("region", { name: "Key figures" });
    expect(figures).toHaveTextContent("Flood-candidate area5.34 km²5.44% of 98.21 km² analysed");
    expect(figures).toHaveTextContent("Overall accuracy94.2%");
    expect(figures).toHaveTextContent("Kappa0.446");
    expect(figures).toHaveTextContent("F1 (flood class)0.477");
    const map = screen.getByRole("img", { name: /^Framed map of the flood-candidate extent \(model-classified\), Rufiji floodplain 2024, 38\.92°E–39\.01°E, 7\.90°S–7\.99°S$/ });
    expect(map).toHaveAttribute("src", url("flood_extent_map_png"));
    const group = screen.getByRole("group", { name: "Map layer" });
    expect(within(group).getByRole("button", { name: "Extent" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "Confidence score" }));
    expect(screen.getByRole("img", { name: /^Framed map of the model confidence score/ })).toHaveAttribute("src", url("flood_probability_map_png"));
    expect(screen.getByRole("region", { name: "Summary" })).toHaveTextContent(rufijiFixture.overview.headline.text);
    expect(screen.getByRole("note", { name: "Accuracy basis" })).toHaveTextContent("independent Sentinel-2 optical reference");
    fireEvent.click(screen.getByRole("button", { name: "See the full accuracy assessment →" }));
    expect(screen.getByRole("tab", { name: "Accuracy assessment", selected: true })).toBeInTheDocument();
  });

  it("keeps the interactive viewer when a result has no framed map", async () => {
    const data = rufiji();
    data.exports = data.exports.filter((item) => item.delivery_type !== "map_png");
    setup(data);
    expect(await screen.findByText("Interactive map viewer")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Map layer" })).toBeNull();
  });
});

describe("Accuracy assessment", () => {
  it("assessed: census metrics, TP/TN/FP/FN with totals and UA/PA, package figures, audit sample, internal agreement apart", async () => {
    setup(rufiji(), "accuracy");
    const metrics = await screen.findByRole("region", { name: "Accuracy metrics" });
    for (const [label, value] of [["Overall accuracy", "94.2%"], ["Cohen's Kappa", "0.446"], ["F1 (flood class)", "0.477"], ["User's accuracy (flood)", "48.9%"], ["Producer's accuracy (flood)", "46.5%"], ["AUC vs Sentinel-2 reference (independent)", "0.805"]] as const) {
      expect(within(metrics).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    // r5.2: the independent AUC tile names its reference and states the census note; the holdout AUC appears only
    // under internal agreement, labelled "not independent".
    expect(within(metrics).getByLabelText("ROC AUC")).toHaveTextContent("census of all eligible pixels: no sampling interval");
    expect(metrics).not.toHaveTextContent(/holdout/);
    const internalSection = screen.getByRole("region", { name: /Internal agreement/ });
    expect(internalSection).toHaveTextContent("AUC vs SAR-derived labels (holdout, not independent)");
    expect(internalSection).not.toHaveTextContent("AUC vs Sentinel-2 reference (independent)");
    const matrix = screen.getByRole("table", { name: /Confusion matrix — rows: model classification/ });
    const rows = within(matrix).getAllByRole("row").map((row) => row.textContent);
    expect(rows[1]).toBe("Model floodedTP 2,807FP 2,9295,73648.9%");
    expect(rows[2]).toBe("Model not floodedFN 3,225TN 97,127100,35296.8%");
    expect(rows[3]).toBe("Total6,032100,056106,088");
    expect(rows[4]).toBe("Producer's accuracy46.5%97.1%");
    const reference = screen.getByRole("region", { name: "Reference data" });
    expect(reference).toHaveTextContent("Census of eligible non-training pixels · n = 106,088 · IoU 0.313 · AP 0.411");
    expect(within(reference).getByLabelText("Audit sample")).toHaveTextContent("Audit sample (250 + 250 points):");
    expect(within(reference).getByLabelText("Audit sample")).toHaveTextContent("Olofsson et al. 2014");
    expect(reference).toHaveTextContent("MNDWI > 0 on the target composite");
    const figures = screen.getByRole("region", { name: "Accuracy figures" });
    expect(within(figures).getAllByRole("img").map((img) => img.getAttribute("src"))).toEqual([url("figure_independent_optical_roc_png"), url("figure_independent_optical_pr_png")]);
    const internal = screen.getByRole("region", { name: /Internal agreement/ });
    expect(within(internal).getByText("not map accuracy")).toBeInTheDocument();
    expect(internal).toHaveTextContent("use the Sentinel-2 figures above for accuracy");
  });

  it("r5.3: points to the per-variable ROC curves only when the result has them", async () => {
    const POINTER = /Per-variable ROC curves .* are in the scientific report \(section 9 and Appendix C\)/;
    const older = setup(rufiji(), "accuracy");
    await screen.findByRole("region", { name: "Accuracy figures" });
    expect(screen.queryByText(POINTER)).toBeNull(); // results from before r5.3 have no per-variable curves
    older.unmount();
    const notAssessable = rufiji();
    (notAssessable.summary.independent_accuracy as Record<string, unknown>).variable_roc = { status: "not_assessable", reason: "x", curves: [] };
    const second = setup(notAssessable, "accuracy");
    await screen.findByRole("region", { name: "Accuracy figures" });
    expect(screen.queryByText(POINTER)).toBeNull();
    second.unmount();
    const data = rufiji();
    (data.summary.independent_accuracy as Record<string, unknown>).variable_roc = { status: "assessed", curves: [] };
    setup(data, "accuracy");
    expect(await screen.findByText(POINTER)).toHaveTextContent("ROC thresholds by variable");
  });

  it("r6.1: the reference coverage is always shown; below 70% the raw figures are never shown (Bundle 5)", async () => {
    const assessed = rufiji();
    (assessed.summary.independent_accuracy as Record<string, unknown>).reference_coverage_text = "Eligible reference pixels cover 98.8% of the analysed area.";
    const first = setup(assessed, "accuracy");
    expect(await screen.findByLabelText("Reference coverage")).toHaveTextContent("Eligible reference pixels cover 98.8% of the analysed area.");
    first.unmount();
    // The API's view of the stored Bundle 5 record (0c53d331): not assessable, raw figures only in the labelled block.
    const COVER = "The Sentinel-2 reference covers only 0.42% of the area (at least 70% of the valid analysed area is required).";
    const bundle5 = kilombero();
    Object.assign(bundle5.validation_dashboard.accuracy_assessment, { independent_reason: COVER });
    bundle5.summary.independent_accuracy = { status: "not_assessable", reason: COVER, coverage_rule: "failed",
      reference_coverage_pct: 0.422, reference_coverage_text: "Eligible reference pixels cover 0.42% of the analysed area.",
      unrepresentative_metrics: { label: "not representative", metrics: { n: 454, overall_accuracy_pct: 48.2, cohens_kappa: -0.015, roc_auc: 0.515 } } } as never;
    setup(bundle5, "accuracy");
    const box = await screen.findByRole("region", { name: "Independent accuracy not assessable" });
    expect(box).toHaveTextContent(`Reason: ${COVER}`);
    expect(box).toHaveTextContent("Eligible reference pixels cover 0.42% of the analysed area.");
    expect(screen.queryByRole("region", { name: "Accuracy metrics" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/48\.2|-0\.015|0\.515|454/);
  });

  it("not assessable (Kilombero): the API reason is prominent and no number is shown as map accuracy", async () => {
    setup(kilombero(), "accuracy");
    const box = await screen.findByRole("region", { name: "Independent accuracy not assessable" });
    expect(box).toHaveTextContent(`Reason: ${REASON}`);
    expect(box).toHaveTextContent("The numbers below are internal agreement with the training labels — they are not map accuracy.");
    expect(screen.queryByRole("region", { name: "Accuracy metrics" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Reference data" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Accuracy figures" })).toBeNull();
    // Outside the clearly labelled internal-agreement section (and the raw data disclosure), no accuracy figure at all.
    const page = document.body.cloneNode(true) as HTMLElement;
    page.querySelectorAll(".fr-internal, details").forEach((element) => element.remove());
    expect(page.textContent).not.toMatch(/94\.2|0\.446|accuracy \d|Overall accuracy|Kappa|F1|AUC|\d+(\.\d+)?%/);
    // Inside it, internal figures are called agreement, never accuracy.
    fireEvent.click(screen.getByText("Internal agreement tables and curves"));
    expect(screen.getByText(/^Overall agreement 100\.0% · Kappa 1\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/^Overall accuracy/)).toBeNull();
    expect(screen.getByRole("note", { name: "Accuracy basis" })).toHaveTextContent(REASON);
    expect(screen.getByRole("region", { name: /Internal agreement/ })).toHaveTextContent("not map accuracy");
  });

  it("not assessable: the overview shows the status and reason instead of accuracy figures", async () => {
    setup(kilombero());
    const figures = await screen.findByRole("region", { name: "Key figures" });
    expect(figures).toHaveTextContent(`Independent accuracyNot assessable${REASON}`);
    expect(figures).not.toHaveTextContent(/Overall accuracy|Kappa|F1/);
    expect(figures).toHaveTextContent("5.34 km²");
  });
});

// Depth & Exposure module, Phase 1: a trimmed copy of the Rufiji hazard record (values from the read-only QA run).
function hazardRecord(status = "assessed") {
  const row = (t: number, wet: number, p50: number, max: number, inside: number) => ({
    return_period_years: t, aep: 1 / t, wet_area_km2: wet * 0.9877, wet_pct_of_aoi: wet,
    depth_m: { p50, mean: p50 - 0.05, p90: max - 0.6, max }, classes: [], observed_extent: { inside_pct: inside, pixels: 5000 },
    including_permanent_water: { wet_pct_of_aoi: wet + 8.9 },
  });
  return status !== "assessed" ? { status, reason: "The area lies outside the GloFAS flood hazard maps (no tile covers it).", citation: "Baugh, C. et al. (2024): Global river flood hazard maps", attribution: "Contains modified GloFAS data", licence: "Licence under confirmation." } : {
    status, method: { note: "Flood defences are not modelled (undefended)." }, aoi: { area_km2: 98.77, covered_pct: 100 },
    permanent_water_km2: 8.76, permanent_water_pct_of_aoi: 8.9,
    return_periods: [row(10, 26.7, 1.18, 2.61, 38.4), row(100, 31.5, 1.79, 3.41, 42.1), row(500, 32.8, 2.09, 3.75, 42.9)],
    occurrence: { years: [10, 30], rows: [10, 100, 500].map((t) => ({ return_period_years: t, aep: 1 / t, probability_at_least_once: { "10": 1 - (1 - 1 / t) ** 10, "30": 1 - (1 - 1 / t) ** 30 } })) },
    citation: "Baugh, C. et al. (2024): Global river flood hazard maps. PID http://data.europa.eu/89h/jrc-floods-floodmapgl_rp50y-tif",
    attribution: "Contains data from GloFAS flood hazard maps (JRC/CEMS), ODbL v1.0. Baugh et al.", licence: "Open Data Commons Open Database License (ODbL) v1.0; access conditions: no limitations (JRC Data Catalogue).",
    produced_work_notice: "Contains data from GloFAS flood hazard maps (JRC/CEMS), ODbL v1.0",
    database_notice: "Derived from the GloFAS flood hazard maps v2.1 (JRC/CEMS). This derivative database is available under the Open Data Commons Open Database License (ODbL) v1.0; no further restrictions are added.",
  };
}
function withHazard(status = "assessed") {
  const data = rufiji() as Fixture & Record<string, unknown>;
  (data.summary as Record<string, unknown>).modelled_flood_hazard = hazardRecord(status);
  const template = data.exports[0]!;
  for (const key of ["figure_modelled_hazard_depth_by_return_period_png", "figure_modelled_hazard_aep_png", "modelled_flood_depth_rp10_map_png", "modelled_flood_depth_rp100_map_png", "modelled_flood_depth_rp500_map_png"]) {
    data.exports.push({ ...template, key, label: key.replaceAll("_", " ") });
  }
  return data;
}

describe("Modelled hazard (Depth & Exposure module)", () => {
  it("has no tab on results without the modelled hazard", async () => {
    setup(rufiji());
    await screen.findByRole("tab", { name: "Overview" });
    expect(screen.queryByRole("tab", { name: "Modelled hazard" })).toBeNull();
  });

  it("shows the per-return-period table, both graphs, the occurrence table, the maps, and the source with the open licence", async () => {
    setup(withHazard(), "hazard");
    const card = await screen.findByRole("region", { name: "Modelled flood hazard" });
    expect(screen.getByRole("tab", { name: "Modelled hazard" })).toHaveAttribute("aria-selected", "true");
    expect(card).toHaveTextContent("Context — not an observation");
    expect(card).toHaveTextContent("Flood defences are not modelled");
    expect(card).toHaveTextContent("Permanent water (8.76 km², 8.9% of the area) is not flooding");
    const rows = within(card).getAllByRole("row").map((row) => row.textContent);
    expect(rows[1]).toBe("1-in-10 years10.0%26.37 km² (26.7%)1.18 / 1.13 / 2.01 / 2.61 m38.4%");
    expect(rows[2]).toContain("1-in-100 years1.0%");
    expect(card).toHaveTextContent("context, not accuracy");
    const figures = screen.getByRole("region", { name: "Hazard figures" });
    expect(within(figures).getAllByRole("img").map((img) => img.getAttribute("src"))).toEqual([url("figure_modelled_hazard_depth_by_return_period_png"), url("figure_modelled_hazard_aep_png")]);
    const occurrence = screen.getByRole("region", { name: "Probability of at least one occurrence" });
    expect(within(occurrence).getAllByRole("row")[2]!.textContent).toBe("100 years1.0%9.6%26.0%");
    expect(within(screen.getByRole("region", { name: "Modelled depth maps" })).getAllByRole("img")).toHaveLength(3);
    const source = screen.getByRole("region", { name: "Source and licence" });
    expect(source).toHaveTextContent("jrc-floods-floodmapgl_rp50y-tif");
    expect(source).toHaveTextContent("Contains data from GloFAS flood hazard maps (JRC/CEMS), ODbL v1.0");
    expect(source).toHaveTextContent("Licence: Open Data Commons Open Database License (ODbL) v1.0");
    expect(source).toHaveTextContent("GIS layers and tables: Derived from the GloFAS flood hazard maps v2.1 (JRC/CEMS). This derivative database is available under the Open Data Commons Open Database License (ODbL) v1.0; no further restrictions are added.");
  });

  it("not available: the reason, no figures", async () => {
    setup(withHazard("not_available"), "hazard");
    expect(await screen.findByRole("status", { name: "Modelled flood hazard" })).toHaveTextContent("Modelled flood hazard: not available. The area lies outside the GloFAS flood hazard maps");
    expect(screen.queryByRole("region", { name: "Hazard figures" })).toBeNull();
    expect(screen.getByRole("region", { name: "Source and licence" })).toBeInTheDocument();
  });
});

function withExposure(status = "assessed") {
  const data = withHazard();
  const counted = (c75: number, c65: number) => ({ status: "counted", "0.75": { count: c75, area_m2: 0 }, "0.65": { count: c65, area_m2: 0 } });
  (data.summary as Record<string, unknown>).flood_exposure = status !== "assessed" ? { status, reason: "WorldPop has no population grid for this area in 2024." } : {
    status, wording: "Estimated exposure: modelled people and detected buildings inside each extent. Not people affected, not damage.",
    population: { year: 2024, year_status: { status: "projected", text: "modelled estimate for 2024, a projection 2 years after the last census (2022)" }, citation: "Bondarenko M. et al. 2025 doi:10.5258/SOTON/WP00839", licence: "CC BY 4.0", release_caveat: "WorldPop R2025A is an alpha release: WorldPop states that it may change over the coming year as improvements are made, so these population figures may change." },
    buildings: { version: "v3 (inference May 2023)", primary_threshold: 0.75, sensitivity_threshold: 0.65, threshold_note: "0.75 is our stated choice.", citation: "Sirko, W. et al. (2021) arXiv:2107.12283", licence: "CC BY 4.0", limitation: "Open Buildings detection quality varies between areas; informal buildings and thatched or vegetated roofs may be missed, so building counts may be too low.", spot_check: "done 2026-11-17 by the owner on the Rufiji observed extent: about 95% or more of the building points sit on real structures" },
    permanent_water: "The observed flood candidates are reported as the flood map defines them. GloFAS permanent-water cells are excluded from the modelled return-period zones only.",
    glofas_zone_notice: "The return-period zones come from the GloFAS flood hazard maps: Derived from the GloFAS flood hazard maps v2.1 (JRC/CEMS). This derivative database is available under the Open Data Commons Open Database License (ODbL) v1.0; no further restrictions are added.",
    observed_extent_caveat: { status: "assessed", users_accuracy_flood_pct: 48.9, text: "These figures inherit the flood map's commission error: against the independent Sentinel-2 reference, 48.9% of the pixels mapped as flood candidates were flooded (user's accuracy for flood), so part of these people and buildings may lie outside the real flood.", built_up_note: "Built-up areas can also produce SAR backscatter change unrelated to flooding." },
    observed_cluster: { share_pct: 51, text: "About half of these people (51%) are in a settled area around 38.975–38.990°E, 7.940–7.955°S, where SAR change can be unrelated to flooding." },
    rows: [
      { extent: "whole_area", label: "Whole area (reference)", area_km2: 98.77, people: 57360.9, people_cells_touching: 57360.9, buildings: counted(7461, 9686) },
      { extent: "observed_extent", label: "Observed flood candidates (this run)", area_km2: 5.33, people: 2236.2, people_cells_touching: 15109.7, buildings: counted(337, 444), sensitivity_glofas_permanent_water_masked: { area_km2: 3.09, people: 2204.0 } },
      { extent: "rp100", label: "Modelled 1-in-100-year zone", area_km2: 31.13, people: 822.6, people_cells_touching: 1179.2, buildings: { status: "not_available", reason: "too dense" } },
    ],
  };
  for (const key of ["exposed_population_observed_extent_map_png", "exposed_population_rp100_map_png"]) data.exports.push({ ...data.exports[0]!, key, label: key });
  return data;
}

describe("Exposure (Depth & Exposure module)", () => {
  it("has no tab without the exposure record", async () => {
    setup(withHazard());
    await screen.findByRole("tab", { name: "Modelled hazard" });
    expect(screen.queryByRole("tab", { name: "Exposure" })).toBeNull();
  });

  it("shows the year as a projection, the table with buildings at both thresholds, the maps and the sources", async () => {
    setup(withExposure(), "exposure");
    const card = await screen.findByRole("region", { name: "Estimated exposure" });
    expect(card).toHaveTextContent("Estimates — not people affected");
    expect(card).toHaveTextContent("WorldPop R2025A, 2024 — modelled estimate for 2024, a projection 2 years after the last census (2022)");
    const rows = within(card).getAllByRole("row").map((row) => row.textContent);
    expect(rows[1]).toBe("Whole area (reference)98.7757,3617,461 (9,686)");
    expect(rows[2]).toBe("Observed flood candidates (this run)5.332,236337 (444)");
    expect(rows[3]).toBe("Modelled 1-in-100-year zone31.13823not available: too dense");
    expect(card).toHaveTextContent("overstates exposure and is not used");
    expect(card).toHaveTextContent("Sensitivity only: masking the observed flood candidates with the coarser GloFAS permanent water would give 3.09 km² and 2,204 people.");
    expect(card).toHaveTextContent("WorldPop R2025A is an alpha release");
    expect(card).toHaveTextContent("informal buildings and thatched or vegetated roofs may be missed");
    expect(card).toHaveTextContent("Spot-check: done 2026-11-17 by the owner on the Rufiji observed extent");
    const caveat = within(card).getByLabelText("Observed extent caveat");
    expect(caveat).toHaveTextContent("48.9% of the pixels mapped as flood candidates were flooded (user's accuracy for flood)");
    expect(caveat).toHaveTextContent("Built-up areas can also produce SAR backscatter change unrelated to flooding.");
    expect(caveat).toHaveTextContent("38.975–38.990°E, 7.940–7.955°S");
    const captions = within(screen.getByRole("region", { name: "Exposure maps" })).getAllByRole("figure").map((f) => f.textContent);
    expect(captions[0]).toContain("user's accuracy for flood");
    expect(captions[1]).not.toContain("user's accuracy for flood");
    expect(within(screen.getByRole("region", { name: "Exposure maps" })).getAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Exposure sources" })).toHaveTextContent("doi:10.5258/SOTON/WP00839");
    expect(screen.getByRole("region", { name: "Exposure sources" })).toHaveTextContent("available under the Open Data Commons Open Database License (ODbL) v1.0");
  });

  it("not available: the reason only", async () => {
    setup(withExposure("not_available"), "exposure");
    expect(await screen.findByRole("status", { name: "Estimated exposure" })).toHaveTextContent("WorldPop has no population grid for this area in 2024.");
  });
});

describe("Downloads", () => {
  it("groups downloads with format and size from the API and keeps protected download URLs", async () => {
    setup(rufiji(), "downloads");
    const headings = (await screen.findAllByRole("heading", { level: 3 })).map((heading) => heading.textContent);
    expect(headings).toEqual(["Reports", "Framed maps", "GIS rasters", "GIS vectors", "GIS-ready styled layers"]);
    expect(screen.getByText(/^Figures and accuracy tables \(\d+ files\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^Audit and provenance \(\d+ files\)$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download the full package (ZIP, 13.3 MiB)" })).toHaveAttribute("href", url("report_package"));
    const reports = screen.getByRole("region", { name: "Reports" });
    expect(within(reports).getByRole("link", { name: "Download Scientific report (PDF) (PDF, 639.4 KiB)" })).toHaveAttribute("href", url("scientific_report_pdf"));
    const rasters = screen.getByRole("region", { name: "GIS rasters" });
    expect(rasters).toHaveTextContent("COG · 5.9 KiB");
    expect(within(rasters).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["flood_extent_cog", "flood_extent_geotiff", "flood_probability_cog", "flood_probability_geotiff"].map(url));
    expect(document.body.textContent).not.toMatch(/\b(MB|KB)\b/);
    expect(within(reports).getByText("FRRIS analysis workbook")).toBeInTheDocument(); // stored label "FIRRIS analysis workbook"
  });

  it("keeps the old register for results without deliverable groups", async () => {
    const data = rufiji();
    for (const item of [...data.products, ...data.exports]) (item as { deliverable_group: string | null }).deliverable_group = null;
    setup(data, "files");
    expect(await screen.findByRole("tab", { name: "Downloads & GIS layers", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data & Files" })).toBeInTheDocument();
  });
});

describe("Provenance", () => {
  it("labels the science version and model id, summarises the sources and lists every provenance field", async () => {
    setup(rufiji(), "provenance");
    const run = await screen.findByRole("region", { name: "Run" });
    expect(within(run).getByText("Science version").nextElementSibling).toHaveTextContent("Science version 2 (id: firris-science-2)");
    expect(within(run).getByText("Model").nextElementSibling).toHaveTextContent("Random Forest baseline, version 1.0 (id: firris-random-forest-baseline)");
    const radar = screen.getByRole("region", { name: "Sentinel-1 radar" });
    expect(within(radar).getByText("Relative orbit").nextElementSibling).toHaveTextContent("57 in both periods");
    expect(within(radar).getByText("Target window").nextElementSibling).toHaveTextContent("24–25 May 2024");
    expect(within(radar).getByText("Target pass").nextElementSibling).toHaveTextContent("2024-05-25");
    const optical = screen.getByRole("region", { name: "Sentinel-2 reference" });
    expect(within(optical).getByText("Scenes used").nextElementSibling).toHaveTextContent("2022-09-02 (baseline) · 2024-05-24 (target)");
    expect(within(optical).getByText("Pixel mask").nextElementSibling).toHaveTextContent("SCL 0, 1, 3, 8, 9, 10, 11");
    const labels = screen.getByRole("region", { name: "Labels and model" });
    expect(within(labels).getByText("Model").nextElementSibling).toHaveTextContent("random forest, 200 trees, seed 12345");
    expect(within(labels).getByText("Class support").nextElementSibling).toHaveTextContent("not flooded 4,728 · flood candidate 272");
    const all = screen.getByRole("region", { name: "All provenance fields" });
    for (const key of Object.keys(rufijiFixture.provenance)) expect(all).toHaveTextContent(key.replaceAll("_", " "));
  });
});
