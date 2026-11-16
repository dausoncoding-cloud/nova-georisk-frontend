// Backlog §4.7 item 1: the UI uses inclusive end dates ("Last day (included)"); the API uses exclusive ends.
// Every conversion goes through this module, so the preflight and the submission send the same dates.

export const SENTINEL1_START = "2014-10-03";

/** Today's date in UTC (the server's "today" for date bounds). */
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** UI last day (inclusive) → API end (exclusive). */
export const toApiEnd = (lastDay: string) => addDays(lastDay, 1);
/** API end (exclusive) → UI last day (inclusive). */
export const toLastDay = (apiEnd: string) => addDays(apiEnd, -1);

export type InclusivePeriod = { start: string; lastDay: string };

export function toApiPeriod(period: InclusivePeriod): { start: string; end: string } {
  return { start: period.start, end: toApiEnd(period.lastDay) };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validation of one window in UI terms: both dates present, first day ≤ last day (a one-day window is valid),
 * and both within [2014-10-03, today UTC]. Returns the problem, or null when the window is valid.
 */
export function periodProblem(name: "Target" | "Baseline", period: InclusivePeriod, today = todayIso()): string | null {
  if (!ISO.test(period.start) || !ISO.test(period.lastDay)) return `${name}: enter the first and the last day.`;
  if (period.start > period.lastDay) return `${name}: the first day must be on or before the last day.`;
  if (period.start < SENTINEL1_START) return `${name}: Sentinel-1 data starts on 3 October 2014.`;
  if (period.lastDay > today) return `${name}: the last day cannot be after today (${today}, UTC).`;
  return null;
}

// Fixed English month abbreviations as in the design ("2 Sep 2022"); Intl en-GB writes "Sept".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDate(), month = date.getUTCMonth(), year = date.getUTCFullYear();
  return { day, month, year, text: `${day} ${MONTHS[month]} ${year}` };
};

/** "14 Nov 2026" for a calendar date (YYYY-MM-DD, UTC). */
export function formatDay(iso: string): string {
  return parts(iso).text;
}

/** "24–25 May 2024", "28 Aug – 2 Sep 2022", "30 Dec 2023 – 2 Jan 2024", "24 May 2024" (inclusive). */
export function formatPeriod(period: InclusivePeriod): string {
  if (!ISO.test(period.start) || !ISO.test(period.lastDay)) return "Not set";
  const a = parts(period.start);
  const b = parts(period.lastDay);
  if (period.start === period.lastDay) return a.text;
  if (a.year !== b.year) return `${a.text} – ${b.text}`;
  if (a.month !== b.month) return `${a.text.replace(` ${a.year}`, "")} – ${b.text}`;
  return `${a.day}–${b.text}`;
}
