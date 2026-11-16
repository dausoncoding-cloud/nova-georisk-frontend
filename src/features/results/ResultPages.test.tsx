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
    for (const [label, value] of [["Overall accuracy", "94.2%"], ["Cohen's Kappa", "0.446"], ["F1 (flood class)", "0.477"], ["User's accuracy (flood)", "48.9%"], ["Producer's accuracy (flood)", "46.5%"], ["ROC AUC", "0.805"]] as const) {
      expect(within(metrics).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
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
