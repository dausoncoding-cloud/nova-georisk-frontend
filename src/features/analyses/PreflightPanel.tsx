import type { AnalysisPreflightPeriod, AnalysisPreflightResponse } from "./analysisApi";
import { Icon } from "../../shared/ui/Icon";
import { addDays, formatDay } from "./periods";

export { SENTINEL1_START, todayIso } from "./periods";

/** The nearest Sentinel-1 pass to an empty window, and the current window extended to include it (API terms: end exclusive). */
export function nearestPassWindow(period: AnalysisPreflightPeriod): { pass: string; start: string; end: string } | null {
  const before = period.nearest_pass_before ?? null;
  const after = period.nearest_pass_after ?? null;
  if (!before && !after) return null;
  const distance = (day: string, edge: string) => Math.abs(Date.parse(day) - Date.parse(edge));
  const pass = !after ? before! : !before ? after : distance(before, period.start) <= distance(after, period.end) ? before : after;
  const passEnd = addDays(pass, 1);
  return { pass, start: pass < period.start ? pass : period.start, end: passEnd > period.end ? passEnd : period.end };
}

/** "Sentinel-2 3 granules on 2 dates (2 tiles: 36LZR, 37MBM), 88% of the area", as assessed by the run's own rule. */
export function sentinel2Text(period: AnalysisPreflightPeriod): string {
  const tiles = period.sentinel2_tiles ?? [];
  if (period.sentinel2_summary) {
    const summary = tiles.length ? `${period.sentinel2_summary.slice(0, -1)}: ${tiles.join(", ")})` : period.sentinel2_summary;
    const coverage = period.sentinel2_aoi_coverage_pct;
    return ` · Sentinel-2 ${summary}${coverage != null ? `, ${coverage}% of the area` : ""}`;
  }
  const count = period.sentinel2_compliant_scenes;
  return count != null ? ` · ${count} compliant Sentinel-2 ${count === 1 ? "scene" : "scenes"}` : "";
}

export const MIB = 1_048_576;
/** Backlog §4.7 item 3: sizes in MiB everywhere ("10.0 of 48 MiB"). */
export function downloadSizeText(capacity: NonNullable<AnalysisPreflightResponse["capacity"]>): string {
  return `${(capacity.estimated_request_bytes / MIB).toFixed(1)} of ${(capacity.limit_bytes / MIB).toFixed(0)} MiB`;
}

function sentinel1Text(period: AnalysisPreflightPeriod): string {
  const passes = period.sentinel1_pass_dates ?? [];
  return `${passes.length ? `Sentinel-1 ${passes.length === 1 ? "pass" : "passes"} ${passes.join(", ")}` : "No Sentinel-1 pass"}${period.relative_orbits?.length ? ` · orbit ${period.relative_orbits.join(", ")}` : ""}`;
}

function PeriodRow({ label, period }: { label: string; period?: AnalysisPreflightPeriod | null }) {
  if (!period) return null;
  const optical = sentinel2Text(period).replace(/^ · /, "");
  return <div className="fr-avail__row"><dt>{label}</dt><dd><span>{sentinel1Text(period)}</span>{optical ? <span className="fr-avail__optical">{optical}</span> : null}</dd></div>;
}

type Props = {
  result?: AnalysisPreflightResponse;
  isFetching: boolean;
  error: string | null;
  onUseNearestPass: (period: "target" | "baseline", start: string, end: string) => void;
};

export function PreflightPanel({ result, isFetching, error, onUseNearestPass }: Props) {
  if (isFetching && !result) return <div className="fr-box fr-box--info" role="status" aria-label="Satellite availability">Checking satellite availability…</div>;
  if (error && !result) return <div className="fr-box fr-box--info" role="status" aria-label="Satellite availability">{error} The server checks availability again when you submit.</div>;
  if (!result) return null;
  const capacity = result.capacity;
  const blocking = result.blocking ?? [];
  const warnings = result.warnings ?? [];
  return <section className="fr-avail" aria-label="Satellite availability" aria-busy={isFetching || undefined}>
    <h3 className="fr-visually-hidden">Satellite availability{isFetching ? " (updating…)" : ""}</h3>
    {isFetching ? <p className="fr-avail__updating" role="status">Updating…</p> : null}
    <dl className="fr-avail__rows">
      <PeriodRow label="Target" period={result.target} />
      <PeriodRow label="Baseline" period={result.baseline} />
      {capacity ? <div className="fr-avail__row"><dt>Download size</dt><dd><span className="fr-num">{downloadSizeText(capacity)}</span><span className="fr-avail__optical">at {capacity.scale_m} m</span></dd></div> : null}
    </dl>
    {blocking.length === 0 ? <p className="fr-box fr-box--success" role="status"><Icon name="check" width={18} height={18} strokeWidth={2.4} />
      Ready: {result.shared_relative_orbits?.length ? `Sentinel-1 orbit ${result.shared_relative_orbits.join(", ")} in both windows.` : "the dates and area pass the checks."}</p> : null}
    {blocking.length ? <div className="fr-box fr-box--danger" role="alert" aria-label="Blocking reasons"><strong>Cannot run with these dates</strong><ul>{blocking.map((issue) => {
      const period = issue.period === "target" ? result.target : issue.period === "baseline" ? result.baseline : null;
      const nearest = issue.code === "no_sentinel1_pass" && period ? nearestPassWindow(period) : null;
      return <li key={`${issue.code}-${issue.period ?? "all"}`}><span>{issue.message}</span>{nearest ? <button type="button" className="fr-button fr-button--secondary fr-button--small" onClick={() => onUseNearestPass(issue.period as "target" | "baseline", nearest.start, nearest.end)}>Use nearest pass ({formatDay(nearest.pass)})</button> : null}</li>;
    })}</ul></div> : null}
    {warnings.length ? <div className="fr-box fr-box--info" role="note" aria-label="Warnings"><Icon name="warning" width={18} height={18} strokeWidth={2} /><ul>{warnings.map((issue) => <li key={`${issue.code}-${issue.period ?? "all"}`}>{issue.message}</li>)}</ul></div> : null}
  </section>;
}
