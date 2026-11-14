import type { AnalysisPreflightPeriod, AnalysisPreflightResponse } from "./analysisApi";

export const SENTINEL1_START = "2014-10-03";

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The nearest Sentinel-1 pass to an empty window, and the one-day window that contains it. */
export function nearestPassWindow(period: AnalysisPreflightPeriod): { pass: string; start: string; end: string } | null {
  const before = period.nearest_pass_before ?? null;
  const after = period.nearest_pass_after ?? null;
  if (!before && !after) return null;
  const distance = (day: string, edge: string) => Math.abs(Date.parse(day) - Date.parse(edge));
  const pass = !after ? before! : !before ? after : distance(before, period.start) <= distance(after, period.end) ? before : after;
  return { pass, start: pass, end: addDays(pass, 1) };
}

type Props = {
  result?: AnalysisPreflightResponse;
  isFetching: boolean;
  error: string | null;
  onUseNearestPass: (period: "target" | "baseline", start: string, end: string) => void;
};

function PeriodLine({ label, period }: { label: string; period?: AnalysisPreflightPeriod | null }) {
  if (!period) return null;
  const passes = period.sentinel1_pass_dates ?? [];
  return <div><dt>{label}</dt><dd>
    {passes.length ? `Sentinel-1 ${passes.length === 1 ? "pass" : "passes"} ${passes.join(", ")}` : "No Sentinel-1 pass"}
    {period.relative_orbits?.length ? ` · orbit ${period.relative_orbits.join(", ")}` : ""}
    {period.sentinel2_compliant_scenes != null ? ` · ${period.sentinel2_compliant_scenes} compliant Sentinel-2 ${period.sentinel2_compliant_scenes === 1 ? "scene" : "scenes"}` : ""}
  </dd></div>;
}

export function PreflightPanel({ result, isFetching, error, onUseNearestPass }: Props) {
  if (isFetching && !result) return <div className="notice" role="status" aria-label="Satellite availability">Checking satellite availability…</div>;
  if (error && !result) return <div className="notice" role="status" aria-label="Satellite availability">{error} The server checks availability again when you submit.</div>;
  if (!result) return null;
  const capacity = result.capacity;
  const blocking = result.blocking ?? [];
  const warnings = result.warnings ?? [];
  return <section className="preflight-panel" aria-label="Satellite availability">
    <h4>Satellite availability{isFetching ? " (updating…)" : ""}</h4>
    {blocking.length === 0 ? <p className="preflight-ok" role="status">Ready: {result.shared_relative_orbits?.length ? `Sentinel-1 orbit ${result.shared_relative_orbits.join(", ")} in both windows.` : "the dates and area pass the checks."}</p> : null}
    <dl className="review-facts">
      <PeriodLine label="Target" period={result.target} />
      <PeriodLine label="Baseline" period={result.baseline} />
      {capacity ? <div><dt>Download size</dt><dd>about {(capacity.estimated_request_bytes / 1_048_576).toFixed(1)} MB of the {(capacity.limit_bytes / 1_048_576).toFixed(0)} MB limit at {capacity.scale_m} m</dd></div> : null}
    </dl>
    {blocking.length ? <div className="inline-alert" role="alert" aria-label="Blocking reasons"><strong>Submission is blocked:</strong><ul>{blocking.map((issue) => {
      const period = issue.period === "target" ? result.target : issue.period === "baseline" ? result.baseline : null;
      const nearest = issue.code === "no_sentinel1_pass" && period ? nearestPassWindow(period) : null;
      return <li key={`${issue.code}-${issue.period ?? "all"}`}>{issue.message}{nearest ? <> <button type="button" className="button button--small" onClick={() => onUseNearestPass(issue.period as "target" | "baseline", nearest.start, nearest.end)}>Use nearest pass ({nearest.pass})</button></> : null}</li>;
    })}</ul></div> : null}
    {warnings.length ? <div className="notice" role="note" aria-label="Warnings"><strong>Warnings:</strong><ul>{warnings.map((issue) => <li key={`${issue.code}-${issue.period ?? "all"}`}>{issue.message}</li>)}</ul></div> : null}
  </section>;
}
