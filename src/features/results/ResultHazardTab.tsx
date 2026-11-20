// Depth & Exposure module, Phase 1 (plan item 1.7): the modelled flood hazard (GloFAS v2.1) next to the flood map.
// Read-only: the record comes from the result summary (summary.modelled_flood_hazard); figures and maps are the
// report's own package files. It is context, never an accuracy measure, and the page says so.
import type { components } from "../../shared/api/generated/nova-browser-api";
import type { ResultArtifact } from "./gisViewer";
import { protectedProductUrl } from "./resultsApi";
import { asRecord } from "./resultView";

type Result = components["schemas"]["ResultResponse"];
type Row = Record<string, unknown>;

const num = (value: unknown, digits = 2) => (typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—");
const pct = (value: unknown) => (typeof value !== "number" ? "—" : value > 0.999 ? "> 99.9%" : `${(value * 100).toFixed(1)}%`);
const MAP_PERIODS = [10, 100, 500];

export function hazardRecord(data: Result): Row | null {
  return asRecord(asRecord(data.summary)?.modelled_flood_hazard) ?? null;
}

function Figure({ resultId, artifact, caption }: { resultId: string; artifact: ResultArtifact | undefined; caption: string }) {
  if (!artifact) return null;
  return <figure className="fr-figure"><img src={protectedProductUrl(resultId, artifact.key)} alt={artifact.label} loading="lazy" /><figcaption>{caption}</figcaption></figure>;
}

export function ResultHazardTab({ data, artifacts }: { data: Result; artifacts: readonly ResultArtifact[] }) {
  const record = hazardRecord(data);
  if (!record) return null;
  const byKey = new Map(artifacts.map((item) => [item.key, item]));
  const method = asRecord(record.method);
  const source = (
    <section className="fr-card fr-section" aria-label="Source and licence">
      <h3>Source and licence</h3>
      {record.produced_work_notice ? <p><strong>{String(record.produced_work_notice)}</strong></p> : null}
      <p>{String(record.citation ?? "")}.</p>
      <p><strong>Licence:</strong> {String(record.licence ?? "")}</p>
      {record.database_notice ? <p className="fr-help">GIS layers and tables: {String(record.database_notice)}</p> : null}
    </section>
  );
  if (record.status !== "assessed") {
    return <div className="fr-tab-stack">
      <section className="fr-box fr-box--warning" role="status" aria-label="Modelled flood hazard"><span><strong>Modelled flood hazard: not available.</strong> {String(record.reason ?? "")}</span></section>
      {source}
    </div>;
  }
  const periods = (Array.isArray(record.return_periods) ? record.return_periods : []).map((row) => asRecord(row) ?? {});
  const area = asRecord(record.aoi) ?? {};
  const occurrence = asRecord(record.occurrence) ?? {};
  const years = Array.isArray(occurrence.years) ? occurrence.years.map(Number) : [];
  const occurrenceRows = (Array.isArray(occurrence.rows) ? occurrence.rows : []).map((row) => asRecord(row) ?? {});
  const hasObserved = periods.some((row) => row.observed_extent);
  const first = asRecord(periods[0]?.including_permanent_water);
  const last = asRecord(periods[periods.length - 1]?.including_permanent_water);
  return <div className="fr-tab-stack">
    <section className="fr-card fr-section" aria-label="Modelled flood hazard">
      <div className="fr-section__head"><h3>Modelled flood hazard (GloFAS v2.1)</h3><span className="fr-pill fr-pill--neutral">Context — not an observation</span></div>
      <p>{String(method?.note ?? "")}</p>
      <p className="fr-help">Area {num(area.area_km2)} km², {num(area.covered_pct, 1)}% inside the GloFAS maps. Permanent water ({num(record.permanent_water_km2)} km², {num(record.permanent_water_pct_of_aoi, 1)}% of the area) is not flooding: it is excluded below and delivered as a separate layer. Including it, the wet share would be {num(first?.wet_pct_of_aoi, 1)}% to {num(last?.wet_pct_of_aoi, 1)}%.</p>
      <div className="fr-table-wrap">
        <table className="fr-table">
          <caption>Modelled river-flood hazard by return period (wet: depth ≥ 0.1 m; area-weighted; permanent water excluded)</caption>
          <thead><tr><th scope="col">Return period</th><th scope="col">AEP</th><th scope="col">Wet area</th><th scope="col">Depth median / mean / p90 / max</th>{hasObserved ? <th scope="col">Flood candidates of this run inside the zone</th> : null}</tr></thead>
          <tbody>{periods.map((row) => {
            const depth = asRecord(row.depth_m) ?? {};
            const observed = asRecord(row.observed_extent);
            return <tr key={String(row.return_period_years)}>
              <th scope="row">1-in-{String(row.return_period_years)} years</th><td className="fr-num">{pct(row.aep)}</td>
              <td className="fr-num">{num(row.wet_area_km2)} km² ({num(row.wet_pct_of_aoi, 1)}%)</td>
              <td className="fr-num">{num(depth.p50)} / {num(depth.mean)} / {num(depth.p90)} / {num(depth.max)} m</td>
              {hasObserved ? <td className="fr-num">{typeof observed?.inside_pct === "number" ? `${observed.inside_pct.toFixed(1)}%` : "—"}</td> : null}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {hasObserved ? <p className="fr-help">The last column is context, not accuracy: the GloFAS maps model undefended river floods of a given return period; the flood map observes one date.</p> : null}
    </section>
    <section className="fr-figures" aria-label="Hazard figures">
      <Figure resultId={data.id} artifact={byKey.get("figure_modelled_hazard_depth_by_return_period_png")} caption="Modelled flood depth by return period of the river discharge, with the wet share of the area." />
      <Figure resultId={data.id} artifact={byKey.get("figure_modelled_hazard_aep_png")} caption="AEP = 1/T, and the probability of at least one occurrence in n years, 1 − (1 − 1/T)ⁿ." />
    </section>
    <section className="fr-card fr-section" aria-label="Probability of at least one occurrence">
      <div className="fr-table-wrap">
        <table className="fr-table">
          <caption>Probability of at least one occurrence of the T-year river discharge in n years (independent years)</caption>
          <thead><tr><th scope="col">Return period</th><th scope="col">AEP</th>{years.map((n) => <th scope="col" key={n}>n = {n}</th>)}</tr></thead>
          <tbody>{occurrenceRows.map((row) => {
            const p = asRecord(row.probability_at_least_once) ?? {};
            return <tr key={String(row.return_period_years)}><th scope="row">{String(row.return_period_years)} years</th><td className="fr-num">{pct(row.aep)}</td>{years.map((n) => <td className="fr-num" key={n}>{pct(p[String(n)])}</td>)}</tr>;
          })}</tbody>
        </table>
      </div>
    </section>
    <section className="fr-figures" aria-label="Modelled depth maps">
      {MAP_PERIODS.map((period) => <Figure key={period} resultId={data.id} artifact={byKey.get(`modelled_flood_depth_rp${period}_map_png`)} caption={`Modelled flood depth, 1-in-${period}-year river discharge (undefended, ~90 m; permanent water in grey). Depth layers for every return period are under Downloads & GIS layers.`} />)}
    </section>
    {source}
  </div>;
}
