// How an ROC AUC is shown (r5.2): what it is measured against, whether it is assessable, and its interval.
// Mirrors the backend rule (app/services/validation/auc_presentation.py) so the Results page and the report agree.
// A holdout AUC is never presented as independent validation.
import type { components } from "../../shared/api/generated/nova-browser-api";

type Scope = components["schemas"]["AccuracyScope"];

export const AUC_MIN_PER_CLASS = 50;
const MIN_DISTINCT_POINTS = 3;
const NEAR_PERFECT = 0.99;

export const AUC_LABELS: Record<Scope["scope"], string> = {
  independent_optical: "AUC vs Sentinel-2 reference (independent)",
  internal_screening: "AUC vs SAR-derived labels (holdout, not independent)",
  internal_supplied: "AUC vs supplied labels (holdout, not independent)",
};
const CAVEATS: Partial<Record<Scope["scope"], string>> = {
  internal_screening: "Near-perfect agreement is expected because the labels come from the same SAR data the model uses; it is not evidence of map accuracy.",
  internal_supplied: "Near-perfect agreement is expected because the model is trained to reproduce these labels from the same inputs; it is not evidence of map accuracy.",
};
const CENSUS_NOTE = "census of all eligible pixels: no sampling interval";

export type AucView = {
  label: string;
  assessable: boolean;
  value: number | null;
  interval: [number, number] | null;
  intervalNote: string | null;
  reason: string | null;
  caveat: string | null;
  positives: number;
  negatives: number;
};

const COUNT = new Intl.NumberFormat("en-GB");
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

export function aucView(scope: Scope): AucView {
  const positives = scope.n_per_reference_class?.["1"] ?? 0;
  const negatives = scope.n_per_reference_class?.["0"] ?? 0;
  const counts = `${COUNT.format(positives)} positive, ${COUNT.format(negatives)} negative`;
  const distinct = new Set((scope.roc ?? []).filter((p) => finite(p.fpr) && finite(p.tpr)).map((p) => `${p.fpr!.toFixed(9)}|${p.tpr!.toFixed(9)}`)).size;
  const value = finite(scope.roc_auc) ? scope.roc_auc : null;
  let reason: string | null = null;
  if (positives === 0 || negatives === 0) reason = `one reference class is empty (${counts})`;
  else if (Math.min(positives, negatives) < AUC_MIN_PER_CLASS) reason = `fewer than ${AUC_MIN_PER_CLASS} samples in a reference class (${counts})`;
  else if (distinct < MIN_DISTINCT_POINTS) reason = "the model scores take too few distinct values to draw an ROC curve";
  else if (value === null) reason = "the AUC could not be computed";
  const raw = scope.confidence_intervals_95?.roc_auc;
  const interval = raw && raw.length === 2 && finite(raw[0]) && finite(raw[1]) ? [raw[0], raw[1]] as [number, number] : null;
  return {
    label: AUC_LABELS[scope.scope], assessable: reason === null, value, interval, reason, positives, negatives,
    intervalNote: scope.method === "census" ? CENSUS_NOTE : interval ? null : "no interval recorded",
    caveat: reason === null && value !== null && value >= NEAR_PERFECT ? CAVEATS[scope.scope] ?? null : null,
  };
}

/** "0.805 (95% CI 0.790–0.820)" or "not assessable: <reason>". */
export function aucValueText(view: AucView): string {
  if (!view.assessable || view.value === null) return `not assessable: ${view.reason}`;
  if (view.interval) return `${view.value.toFixed(3)} (95% CI ${view.interval[0].toFixed(3)}–${view.interval[1].toFixed(3)})`;
  return view.intervalNote ? `${view.value.toFixed(3)} (${view.intervalNote})` : view.value.toFixed(3);
}
