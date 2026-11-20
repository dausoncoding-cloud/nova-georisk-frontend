// Trend Analysis (docs/FRRIS_TREND_ANALYSIS_PLAN.md): the Trends tab. Read-only from summary.trend_analysis; the
// statistics come from the API (rules in the backend): this page draws and words them, it never recomputes them.
import type { components } from "../../shared/api/generated/nova-browser-api";
import { Disclosure } from "../../shared/ui/Disclosure";
import type { ResultArtifact } from "./gisViewer";
import { LineChart, type ChartPoint, type ChartTrend } from "./LineChart";
import { protectedProductUrl } from "./resultsApi";
import { asRecord } from "./resultView";

type Result = components["schemas"]["ResultResponse"];
type Row = Record<string, unknown>;

const num = (value: unknown, digits = 2) => (typeof value === "number" && Number.isFinite(value)
  ? value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—");

export function trendRecord(data: Result): Row | null {
  return asRecord(asRecord(data.summary)?.trend_analysis) ?? null;
}

/** "n = 28 valid of 38 points; change 1986 → 2021: +1.67 km² (83.2%); trend +0.083 km² per year, R² = 0.12, p = 0.0712". */
export function statisticsLine(series: Row): string {
  const summary = asRecord(series.summary) ?? {};
  const units = String(series.units ?? "");
  const parts = [`n = ${Number(summary.n_valid ?? 0)} valid of ${Number(series.n_points ?? 0)} points`];
  const change = asRecord(summary.change);
  if (change && typeof change.delta === "number") {
    parts.push(`change ${String(change.from)} → ${String(change.to)}: ${change.delta >= 0 ? "+" : ""}${num(change.delta)} ${units} (${String(change.percent_text)})`);
  }
  const trend = summary.kind === "trend" ? asRecord(summary.trend) : null;
  if (trend && typeof trend.slope === "number" && typeof trend.r_squared === "number" && typeof trend.p_value === "number") {
    parts.push(`trend ${trend.slope >= 0 ? "+" : ""}${trend.slope.toFixed(3)} ${String(trend.slope_units)}, R² = ${trend.r_squared.toFixed(2)}, p = ${Number(trend.p_value.toPrecision(3))}`);
  } else if (summary.text) {
    parts.push(String(summary.text));
  }
  return parts.join("; ");
}

function chartTrend(series: Row): ChartTrend {
  const summary = asRecord(series.summary) ?? {};
  const trend = summary.kind === "trend" ? asRecord(summary.trend) : null;
  return trend && typeof trend.slope === "number" && typeof trend.intercept === "number" ? { slope: trend.slope, intercept: trend.intercept } : null;
}

function points(series: Row): ChartPoint[] {
  return (Array.isArray(series.points) ? series.points : []).map((point) => {
    const p = asRecord(point) ?? {};
    return { t: p.t as number | string, value: typeof p.value === "number" ? p.value : null, flagged: Boolean(p.flagged) };
  });
}

function SeriesTable({ series }: { series: Row }) {
  const columns = Object.entries(asRecord(series.columns) ?? {});
  const rows = (Array.isArray(series.points) ? series.points : []).map((point) => asRecord(point) ?? {});
  return <Disclosure title={`Table (${rows.length} points)`}>
    <div className="fr-table-wrap"><table className="fr-table">
      <thead><tr><th scope="col">{series.x === "year" ? "Year" : "Date"}</th><th scope="col">{String(series.axis_label ?? series.indicator)} ({String(series.units)})</th>
        {columns.map(([key, label]) => <th key={key} scope="col">{String(label)}</th>)}<th scope="col">Flag</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={String(row.t)}>
        <th scope="row">{String(row.t)}</th><td className="fr-num">{num(row.value)}</td>
        {columns.map(([key]) => <td key={key} className="fr-num">{Array.isArray(row[key]) ? (row[key] as unknown[]).join(", ") : typeof row[key] === "number" ? num(row[key], 1) : String(row[key] ?? "")}</td>)}
        <td>{String(row.flag ?? "")}</td></tr>)}</tbody>
    </table></div>
  </Disclosure>;
}

function CsvLink({ resultId, artifact }: { resultId: string; artifact: ResultArtifact | undefined }) {
  return artifact ? <p><a className="fr-button fr-button--secondary" href={protectedProductUrl(resultId, artifact.key)} download>Download CSV</a></p> : null;
}

function SeriesCard({ data, series, artifact, badge }: { data: Result; series: Row; artifact: ResultArtifact | undefined; badge: string }) {
  const title = String(series.title ?? series.key);
  if (series.status !== "assessed") {
    return <section className="fr-box fr-box--warning" role="status" aria-label={title}><span><strong>{title}: not available.</strong> {String(series.reason ?? "")}</span></section>;
  }
  const yLabel = `${String(series.axis_label ?? series.indicator)} (${String(series.units)})`;
  return <section className="fr-card fr-section" aria-label={title}>
    <div className="fr-section__head"><h3>{title}</h3><span className="fr-pill fr-pill--neutral">{badge}</span></div>
    <LineChart points={points(series)} trend={chartTrend(series)} title={title} xLabel={series.x === "year" ? "Year" : "Date"} yLabel={yLabel} />
    <p className="fr-help" aria-label="Chart key">Solid line: valid points. Hollow grey points: flagged (shown, not used).{chartTrend(series) ? " Dashed line: trend line, a visual aid describing the past, not a forecast." : ""}</p>
    <p aria-label="Statistics">{statisticsLine(series)}</p>
    <p className="fr-help"><strong>Method:</strong> {String(series.method ?? "")}</p>
    <ul className="fr-help">{(Array.isArray(series.caveats) ? series.caveats : []).map((text) => <li key={String(text)}>{String(text)}</li>)}</ul>
    <p className="fr-help"><strong>Source:</strong> {String(series.source ?? "")}</p>
    <SeriesTable series={series} />
    <CsvLink resultId={data.id} artifact={artifact} />
  </section>;
}

export function ResultTrendsTab({ data, artifacts }: { data: Result; artifacts: readonly ResultArtifact[] }) {
  const record = trendRecord(data);
  if (!record) return null;
  if (record.status !== "assessed") {
    return <section className="fr-box fr-box--warning" role="status" aria-label="Trend analysis"><span><strong>Trend analysis: not available.</strong> {String(record.reason ?? "")}</span></section>;
  }
  const series = asRecord(record.series) ?? {};
  const byKey = new Map(artifacts.map((item) => [item.key, item]));
  const anomaly = asRecord(record.rainfall_anomaly);
  const get = (key: string) => asRecord(series[key]) ?? { key, status: "not_available", title: key };
  return <div className="fr-tab-stack">
    <section className="fr-card fr-section" aria-label="Trend analysis">
      <div className="fr-section__head"><h3>Trend analysis</h3><span className="fr-pill fr-pill--neutral">Describes the past — not a forecast</span></div>
      <p>Three series describe this area over time. Every chart gives its units and source. A trend line is drawn only with at least 6 valid points; two points are a change, never a trend; flagged points are shown but not used; a percentage change from 0 is undefined.</p>
    </section>
    <SeriesCard data={data} series={get("surface_water_annual")} artifact={byKey.get("trend_surface_water_annual_csv")} badge="Surface water — not flood extent" />
    <SeriesCard data={data} series={get("rainfall_daily")} artifact={byKey.get("trend_rainfall_daily_csv")} badge="Rainfall — no trend line" />
    {anomaly?.status === "assessed" ? <section className="fr-card fr-section" aria-label="Rainfall anomaly">
      <h3>Rainfall anomaly</h3>
      <div className="fr-table-wrap"><table className="fr-table">
        <thead><tr><th scope="col">Window</th><th scope="col">Total (mm)</th><th scope="col">1991–2020 mean of the same window (mm)</th><th scope="col">Anomaly</th></tr></thead>
        <tbody><tr><th scope="row">{String(anomaly.window_days)} days to {String(anomaly.last_day)}</th><td className="fr-num">{num(anomaly.total_mm, 1)}</td>
          <td className="fr-num">{num(anomaly.climatology_mean_mm, 1)}</td><td>{String(anomaly.anomaly_text ?? "—")}</td></tr></tbody>
      </table></div>
      <CsvLink resultId={data.id} artifact={byKey.get("trend_rainfall_anomaly_csv")} />
    </section> : null}
    <SeriesCard data={data} series={get("rainfall_dekadal")} artifact={byKey.get("trend_rainfall_dekadal_csv")} badge="Rainfall — no trend line" />
    <SeriesCard data={data} series={get("sar_open_water")} artifact={byKey.get("trend_sar_open_water_csv")} badge="Not the flood map — not accuracy-assessed" />
  </div>;
}
