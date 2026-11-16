// Running / failed analysis presentation (UI refresh P5). Everything comes from the task API: status, progress,
// timestamps, execution events and the allow-listed error summary. The API does not report a named stage yet
// (backend follow-up), so progress is shown as a percentage and the run's steps are described, not ticked.
import type { components } from "../../shared/api/generated/nova-browser-api";
import { inclusiveWindow } from "../results/resultView";

type ExecutionEvent = components["schemas"]["ExecutionEvent"];

/** The steps of the FRRIS run, as described in the design. Not a status: the API reports a percentage. */
export const RUN_STEPS = [
  ["Checking inputs", "Area, dates and data availability"],
  ["Finding scenes", "Sentinel-1 baseline and target, Sentinel-2 reference"],
  ["Downloading data", "Sentinel-1, elevation and rainfall from Earth Engine"],
  ["Classifying", "Training labels and Random Forest classification"],
  ["Assessing accuracy", "Comparison with the Sentinel-2 reference"],
  ["Preparing outputs", "Framed maps, GIS layers and report"],
] as const;

export type FailureExplanation = { title: string; detail: string | null; hints: string[] };

const pct = (value: string) => `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)}%`;

/**
 * Plain-language explanation for the backend's allow-listed failure messages (user_messages.py, plan 4.2).
 * The message itself is always shown as delivered; this only adds a title, figures parsed from it, and next steps.
 */
export function explainFailure(summary: string | null | undefined): FailureExplanation {
  const message = summary ?? "";
  const coverage = /^Valid pixel coverage (\d+\.\d{2})% is below the configured (\d+\.\d{2})% threshold\.?$/.exec(message);
  if (coverage) return {
    title: "Not enough valid radar data over the area",
    detail: `Valid data covers ${pct(coverage[1]!)} of the area; at least ${pct(coverage[2]!)} is required for a reliable result.`,
    hints: ["Choose dates where the Sentinel-1 pass covers the whole area (the availability check shows the passes).", "Redraw the area so it lies inside the radar swath."],
  };
  // r5.1: radar passes that cover only part of the area (a wide AOI across the edge of the orbit's swath).
  const radar = /^The Sentinel-1 radar pass .+ covers only (\d+(?:\.\d+)?)% of the area\./.exec(message);
  if (radar) return {
    title: "The radar pass does not cover the whole area",
    detail: `Sentinel-1 from one orbit covers ${radar[1]}% of the area; FRRIS needs one orbit over all of it.`,
    hints: ["Split the area in the Area playground so that each part lies inside one radar swath, and run each part.",
      "Or trim the area to the part the radar pass covers.", "The availability check in New analysis now shows this before you run."],
  };
  // P6 wording ("between 21 and 22 May 2024", "on 21 May 2024") and the pre-P6 wording of stored failures.
  if (/^No Sentinel-1 scene over the area (between .+ and .+|on .+)\.$/.test(message)) return {
    title: "No Sentinel-1 pass in the chosen window",
    detail: null,
    hints: ["Widen the window or use the nearest pass offered by the availability check.", "Sentinel-1 passes over the same area about every 12 days."],
  };
  if (/^The target and baseline windows must each contain Sentinel-1 passes from exactly one relative orbit/.test(message)) return {
    title: "The radar orbits do not match",
    detail: null,
    hints: ["Choose windows that each contain passes from the same single relative orbit (the availability check lists the orbits).", "Shorter windows usually contain a single orbit."],
  };
  return {
    title: "The analysis could not be completed",
    detail: null,
    hints: ["Retry the analysis with the same settings.", "If it fails again, share the reference below with support."],
  };
}

const ACTIONS: Record<string, string> = {
  initialized: "Initialized", retry_created: "Retry created", submitted: "Submitted", enqueued: "Queued", started: "Started", sources_revalidated: "Sources re-validated",
  completed: "Completed", failed: "Stopped", canceled: "Canceled",
};

export type TimelineItem = { key: string; label: string; at: string; tone: "done" | "stop" | "neutral" };

/** The run's recorded events, with consecutive progress reports merged into the last one. */
export function timeline(events: readonly ExecutionEvent[] | null | undefined): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const event of events ?? []) {
    if (event.action === "progress") {
      const label = `Progress ${Math.round(event.progress_pct)}%`;
      const last = items.at(-1);
      if (last?.key.startsWith("progress")) { last.label = label; last.at = event.at; continue; }
      items.push({ key: `progress-${event.sequence}`, label, at: event.at, tone: "done" });
      continue;
    }
    items.push({ key: `${event.action}-${event.sequence}`, label: ACTIONS[event.action] ?? event.action.replaceAll("_", " "), at: event.at,
      tone: event.action === "failed" ? "stop" : event.action === "canceled" ? "neutral" : "done" });
  }
  return items;
}

const findPeriod = (value: unknown, key: string, depth = 0): unknown => {
  if (!value || typeof value !== "object" || depth > 6) return null;
  const record = value as Record<string, unknown>;
  if (key in record) return record[key];
  for (const child of Object.values(record)) { const found = findPeriod(child, key, depth + 1); if (found) return found; }
  return null;
};

/** Target and baseline windows from the submitted parameters (task archive), shown inclusive. */
export function submittedPeriods(parameters: unknown) {
  return { target: inclusiveWindow(findPeriod(parameters, "target_period")), baseline: inclusiveWindow(findPeriod(parameters, "baseline_period")) };
}

const TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
export const formatTime = (iso: string | null | undefined) => iso ? `${TIME.format(new Date(iso)).replace("Sept", "Sep")} UTC` : null;
