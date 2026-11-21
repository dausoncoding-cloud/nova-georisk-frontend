// FRRIS v1.1 (docs/FRRIS_ADMIN_LEVEL_EXPOSURE_PLAN.md §5): estimated exposure by administrative unit, on the Exposure tab.
// Read-only from summary.flood_exposure.by_admin_unit. A level selector (Region, District, Ward) and an extent selector;
// a horizontal bar chart of people per unit (top 15 + "Other units"; buildings as labels); the full table; CSV and
// GeoPackage links. Wards show "Ward boundaries not yet provided" until the client's NBS wards are approved. Estimates,
// never "people affected".
import { useState } from "react";
import type { ResultArtifact } from "./gisViewer";
import { protectedProductUrl } from "./resultsApi";
import { asRecord } from "./resultView";

type Row = Record<string, unknown>;
type Cell = { people: number | null; buildings: number | null; buildings065: number | null };
type UnitLine = { name: string; parent: string | null; share: number | null; cell: Cell; other?: boolean; outside?: boolean };

export const TOP_UNITS = 15;
const OUTSIDE_ID = "_outside";
const LEVEL_ORDER = ["L1", "L2", "L3"] as const;
const PLURAL: Record<string, string> = { Region: "Regions", District: "Districts", Ward: "Wards" };

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const int = (value: number | null) => (value === null ? "—" : Math.round(value).toLocaleString("en-GB"));
const share = (value: number | null) => {
  if (value === null) return "—";
  const pct = value * 100;
  return pct >= 99.95 ? "100%" : pct > 0 && pct < 0.1 ? "< 0.1%" : `${pct.toFixed(1)}%`;
};
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
const buildingsText = (cell: Cell) => (cell.buildings === null ? "not counted"
  : cell.buildings065 === null ? int(cell.buildings) : `${int(cell.buildings)} (${int(cell.buildings065)})`);

function cellOf(row: Row, extent: string): Cell {
  const values = asRecord(asRecord(row.extents)?.[extent]) ?? {};
  return { people: num(values.people), buildings: num(values.buildings), buildings065: num(values.buildings_065) };
}

/** All units sorted by people (descending) for the chosen extent, then "Outside any unit" when it is shown. */
export function unitLines(level: Row, extent: string): UnitLine[] {
  const rows = (Array.isArray(level.rows) ? level.rows : []).map((row) => asRecord(row) ?? {});
  const units = rows.filter((row) => row.unit_id !== OUTSIDE_ID).map((row) => ({
    name: String(row.name ?? ""), parent: row.parent ? String(row.parent) : null, share: num(row.share_of_unit_in_aoi), cell: cellOf(row, extent),
  }));
  units.sort((a, b) => (b.cell.people ?? 0) - (a.cell.people ?? 0) || a.name.localeCompare(b.name));
  const outside = rows.filter((row) => row.unit_id === OUTSIDE_ID).map((row) => ({
    name: String(row.name ?? "Outside any unit"), parent: null, share: null, cell: cellOf(row, extent), outside: true,
  }));
  return [...units, ...outside];
}

/** The chart's bars: the top units, then one "Other units" bar with the rest (so the bars still add up). */
export function chartBars(lines: readonly UnitLine[], top = TOP_UNITS): UnitLine[] {
  const units = lines.filter((line) => !line.outside);
  const rest = units.slice(top);
  const bars = units.slice(0, top);
  if (rest.length) {
    const add = (key: keyof Cell) => rest.reduce<number | null>((sum, line) => (sum === null || line.cell[key] === null ? null : sum + (line.cell[key] as number)), 0);
    bars.push({ name: `Other units (${rest.length})`, parent: null, share: null, other: true,
      cell: { people: add("people"), buildings: add("buildings"), buildings065: add("buildings065") } });
  }
  return [...bars, ...lines.filter((line) => line.outside)];
}

function BarChart({ bars, title }: { bars: readonly UnitLine[]; title: string }) {
  const max = Math.max(1, ...bars.map((bar) => bar.cell.people ?? 0));
  const W = 640, LABEL = 150, VALUE = 230, ROW = 24, TOP = 6;  // VALUE leaves room for "12,345 people · 1,234 buildings"
  const H = TOP * 2 + bars.length * ROW;
  const width = W - LABEL - VALUE;
  return <svg className="fr-bar-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
    <title>{title}</title>
    {bars.map((bar, index) => {
      const y = TOP + index * ROW;
      const length = ((bar.cell.people ?? 0) / max) * width;
      const label = bar.name.length > 24 ? `${bar.name.slice(0, 23)}…` : bar.name;
      return <g key={`${bar.name}-${index}`}>
        <text x={LABEL - 8} y={y + ROW / 2} textAnchor="end" dominantBaseline="middle" fontSize="12">{label}</text>
        <rect x={LABEL} y={y + 4} width={Math.max(length, bar.cell.people ? 1 : 0)} height={ROW - 8}
          fill={bar.other || bar.outside ? "#9AA5B1" : "#0072B2"} />
        <text x={LABEL + length + 6} y={y + ROW / 2} dominantBaseline="middle" fontSize="12">
          {int(bar.cell.people)} people · {bar.cell.buildings === null ? "buildings not counted" : `${int(bar.cell.buildings)} buildings`}
        </text>
      </g>;
    })}
  </svg>;
}

function sourceText(level: Row): string {
  const prov = asRecord(level.provenance) ?? {};
  if (prov.dataset === "geoBoundaries") {
    const grouped = level.level === "L1" ? " Regions are built by merging these districts." : "";
    return `Boundaries: geoBoundaries ${String(prov.release_type ?? "")} ${String(prov.boundaryID ?? "")}, ${String(prov.source ?? "")}, ${String(prov.year_represented ?? "")}; licence ${String(prov.licence ?? "")}.${grouped}`;
  }
  if (prov.dataset_id) return `Boundaries: ${String(prov.dataset ?? "")} (reviewed dataset); licence ${String(asRecord(prov.licence)?.name ?? prov.licence ?? "")}.`;
  return "";
}

function sumCheck(level: Row, extent: string): string | null {
  const entry = asRecord(asRecord(asRecord(level.check)?.extents)?.[extent]);
  const people = num(entry?.people_total);
  if (!entry || people === null) return null;
  const buildings = entry.buildings_ok === true ? `, ${int(num(entry.buildings_total))} buildings` : "";
  return `Units add up to the area total: ${int(people)} people${buildings}.`;
}

export function ResultAdminExposure({ record, resultId, artifacts }: { record: Row; resultId: string; artifacts: readonly ResultArtifact[] }) {
  const by = asRecord(record.by_admin_unit);
  const levels = (Array.isArray(by?.levels) ? by.levels : []).map((level) => asRecord(level) ?? {});
  const extents = (Array.isArray(by?.extents) ? by.extents : []).map((extent) => asRecord(extent) ?? {});
  const byCode = new Map(levels.map((level) => [String(level.level), level]));
  const present = LEVEL_ORDER.filter((code) => byCode.has(code));
  const firstAssessed = present.find((code) => code === "L2" && byCode.get(code)?.status === "assessed")
    ?? present.find((code) => byCode.get(code)?.status === "assessed") ?? present[0];
  const [levelCode, setLevelCode] = useState<string | undefined>(firstAssessed);
  const [extent, setExtent] = useState<string>(extents.some((item) => item.key === "observed_extent") ? "observed_extent" : String(extents[0]?.key ?? ""));
  if (!by) return null;
  const files = new Map(artifacts.map((item) => [item.key, item]));
  const csv = files.get("flood_exposure_by_admin_unit_csv");
  const gpkg = files.get("exposure_by_admin_unit_gpkg");
  const level = levelCode ? byCode.get(levelCode) : undefined;
  const extentLabel = String(extents.find((item) => item.key === extent)?.label ?? extent);
  const levelName = String(level?.level_name ?? "");
  const lines = level && level.status === "assessed" ? unitLines(level, extent) : [];
  const total = asRecord(asRecord(asRecord(level?.check)?.extents)?.[extent]);
  return <section className="fr-card fr-section" aria-label="Exposure by administrative unit">
    <div className="fr-section__head">
      <h3>Exposure by administrative unit</h3>
      <div role="group" aria-label="Administrative level" className="fr-segmented">
        {present.map((code) => <button key={code} type="button" aria-pressed={code === levelCode} onClick={() => setLevelCode(code)}>
          {PLURAL[String(byCode.get(code)?.level_name)] ?? String(byCode.get(code)?.level_name)}
        </button>)}
      </div>
    </div>
    <p className="fr-help">Each unit is clipped to the analysis area; a unit only partly inside is never reported as if whole, and its share inside the area is shown. Units add up to the area totals (buildings exactly, people within 0.5 person or 0.01%). Estimates, not people affected.</p>
    {!level ? <p className="fr-help">No administrative level was assessed for this run.</p>
      : level.status !== "assessed" ? <p className="fr-box fr-box--warning" role="status"><span><strong>{PLURAL[levelName] ?? levelName}:</strong> {sentence(String(level.reason ?? "not available"))}</span></p>
        : <>
          <label className="field"><span>Extent</span>
            <select value={extent} onChange={(event) => setExtent(event.target.value)}>
              {extents.map((item) => <option key={String(item.key)} value={String(item.key)}>{String(item.label ?? item.key)}</option>)}
            </select>
          </label>
          <BarChart bars={chartBars(lines)} title={`Estimated people by ${levelName.toLowerCase()}: ${extentLabel}`} />
          <div className="fr-table-wrap">
            <table className="fr-table">
              <caption>Estimated exposure by {levelName.toLowerCase()}: {extentLabel} (WorldPop R2025A, area-weighted; Open Buildings v3, centroid inside)</caption>
              <thead><tr><th scope="col">{levelName}</th>{levelCode !== "L1" ? <th scope="col" className="fr-nowrap">Region</th> : null}<th scope="col">Share inside the area</th><th scope="col">People (estimate)</th><th scope="col">Buildings ≥ 0.75 (≥ 0.65)</th></tr></thead>
              <tbody>
                {lines.map((line) => <tr key={line.name}>
                  <th scope="row">{line.name}</th>{levelCode !== "L1" ? <td>{line.parent ?? "—"}</td> : null}<td className="fr-num">{share(line.share)}</td>
                  <td className="fr-num">{int(line.cell.people)}</td><td className="fr-num">{buildingsText(line.cell)}</td>
                </tr>)}
                <tr><th scope="row">Total (the area totals)</th>{levelCode !== "L1" ? <td /> : null}<td /><td className="fr-num">{int(num(total?.people_total))}</td><td className="fr-num">{num(total?.buildings_total) === null ? "—" : buildingsText({ people: null, buildings: num(total?.buildings_total), buildings065: num(total?.buildings_065_total) })}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="fr-help">{[sumCheck(level, extent), level.buildings_note ? String(level.buildings_note) : null, sourceText(level)].filter(Boolean).join(" ")}</p>
        </>}
    {csv || gpkg ? <p className="fr-help">
      {csv ? <a href={protectedProductUrl(resultId, csv.key)}>Download the table (CSV)</a> : null}
      {csv && gpkg ? " · " : null}
      {gpkg ? <a href={protectedProductUrl(resultId, gpkg.key)}>GeoPackage (units with every figure)</a> : null}
    </p> : null}
  </section>;
}
