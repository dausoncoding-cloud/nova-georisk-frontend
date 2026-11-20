// Trend Analysis (plan §2, §5): a small SVG line chart, drawn like the other charts in the app (no chart library).
// X = time (years or ISO dates), Y = the indicator with its units. Valid points are joined; flagged points are drawn
// hollow and break the line; the dashed trend line is drawn only when the API reports a statistically significant
// trend, and is labelled as a visual aid, not a forecast.
export type ChartPoint = { t: number | string; value: number | null; flagged?: boolean };
export type ChartTrend = { slope: number; intercept: number } | null;

const W = 640, H = 260, M = { top: 16, right: 16, bottom: 44, left: 56 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Years stay years; ISO dates become decimal years (the same convention as the API's trend line). */
export function decimalYear(t: number | string): number {
  if (typeof t === "number") return t;
  const date = new Date(`${t.slice(0, 10)}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}

function tickLabel(value: number, years: boolean): string {
  if (years) return String(Math.round(value));
  const year = Math.floor(value);
  const ms = Date.UTC(year, 0, 1) + (value - year) * (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1));
  const date = new Date(ms);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(2)}`;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((step) => step * power).find((candidate) => candidate >= value) ?? value;
}

export function LineChart({ points, trend, xLabel, yLabel, title, colour = "#0072B2" }: {
  points: readonly ChartPoint[]; trend?: ChartTrend; xLabel: string; yLabel: string; title: string; colour?: string;
}) {
  const years = points.every((point) => typeof point.t === "number");
  const drawn = points.filter((point) => point.value !== null && Number.isFinite(point.value));
  if (!drawn.length) return <p className="fr-help">No values to draw.</p>;
  const xs = drawn.map((point) => decimalYear(point.t));
  const x0 = Math.min(...xs), x1 = Math.max(...xs) === x0 ? x0 + 1 : Math.max(...xs);
  const yMax = niceMax(Math.max(...drawn.map((point) => point.value as number)) * 1.05);
  const sx = (x: number) => M.left + ((x - x0) / (x1 - x0)) * (W - M.left - M.right);
  const sy = (y: number) => H - M.bottom - (Math.max(0, y) / yMax) * (H - M.top - M.bottom);
  const valid = drawn.filter((point) => !point.flagged);
  const flagged = drawn.filter((point) => point.flagged);
  // A flagged or missing point breaks the line (a gap), so flagged years never look like part of the series.
  let pen = false;
  const path = points.map((point) => {
    if (point.flagged || point.value === null || !Number.isFinite(point.value)) { pen = false; return ""; }
    const step = `${pen ? "L" : "M"}${sx(decimalYear(point.t)).toFixed(1)},${sy(point.value).toFixed(1)}`;
    pen = true;
    return step;
  }).filter(Boolean).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xTicks = Array.from({ length: 6 }, (_, i) => x0 + (i / 5) * (x1 - x0));
  const trendEnds = trend && valid.length ? [decimalYear(valid[0]!.t), decimalYear(valid[valid.length - 1]!.t)] : null;
  return (
    <svg className="fr-line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${yLabel} against ${xLabel}.`}>
      <title>{title}</title>
      {yTicks.map((tick) => <g key={tick}>
        <line x1={M.left} x2={W - M.right} y1={sy(tick)} y2={sy(tick)} stroke="#e3e3e3" />
        <text x={M.left - 6} y={sy(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#555">{Number(tick.toPrecision(3)).toLocaleString("en-GB")}</text>
      </g>)}
      {xTicks.map((tick) => <text key={tick} x={sx(tick)} y={H - M.bottom + 16} textAnchor="middle" fontSize="11" fill="#555">{tickLabel(tick, years)}</text>)}
      <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="#888" />
      <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} stroke="#888" />
      <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#333">{xLabel}</text>
      <text transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="#333">{yLabel}</text>
      {path ? <path d={path} fill="none" stroke={colour} strokeWidth="2" data-testid="series-line" /> : null}
      {valid.length <= 60 ? valid.map((point) => <circle key={String(point.t)} cx={sx(decimalYear(point.t))} cy={sy(point.value as number)} r="3" fill={colour} />) : null}
      {flagged.map((point) => <circle key={`f-${point.t}`} cx={sx(decimalYear(point.t))} cy={sy(point.value as number)} r="3.5" fill="white" stroke="#9a9a9a" strokeWidth="1.5" data-testid="flagged-point" />)}
      {trend && trendEnds ? <line data-testid="trend-line" x1={sx(trendEnds[0]!)} x2={sx(trendEnds[1]!)}
        y1={sy(trend.intercept + trend.slope * trendEnds[0]!)} y2={sy(trend.intercept + trend.slope * trendEnds[1]!)}
        stroke="#D55E00" strokeWidth="1.5" strokeDasharray="6 4" /> : null}
    </svg>
  );
}
