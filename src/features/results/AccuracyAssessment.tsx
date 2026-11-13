import type { components } from "../../shared/api/generated/nova-browser-api";

type Assessment = components["schemas"]["AccuracyAssessment"];
type Scope = components["schemas"]["AccuracyScope"];
type Ratio = components["schemas"]["AccuracyRatio"];

const DASH = "—";
const count = new Intl.NumberFormat("en-US");
const fixed = (value: number | null | undefined, digits: number) => (value === null || value === undefined || !Number.isFinite(value) ? DASH : value.toFixed(digits));
const ratio = (value: Ratio) => `${value.fraction} (${value.pct === null ? DASH : `${value.pct.toFixed(1)}%`})`;
const statusText: Record<string, string> = {
  not_assessable: "not assessable", insufficient_reference_samples: "insufficient reference samples", not_performed: "not performed",
};

// Same names as the report tables, CSV headers and figures (backend accuracy_tables.reference_columns).
const REFERENCE_COLUMNS: Record<string, [string, string]> = {
  independent_optical: ["Reference: new open water (optical)", "Reference: no new open water"],
  internal_screening: ["SAR screening label: flood candidate", "SAR screening label: not flood candidate"],
  internal_supplied: ["Supplied label: flood", "Supplied label: not flood"],
};

function ConfusionMatrix({ scope }: { scope: Scope }) {
  const [referenceFlood, referenceOther] = REFERENCE_COLUMNS[scope.scope] ?? ["Reference: flood candidate", "Reference: not flood candidate"];
  const matrix = scope.confusion_matrix;
  const rows = [{ key: "1" as const, label: "Classified: flood candidate" }, { key: "0" as const, label: "Classified: not flood candidate" }];
  return (
    <div className="accuracy-table-wrap"><table className="accuracy-table">
      <caption>Confusion matrix (classified × reference), n = {count.format(scope.n)}</caption>
      <thead><tr><th scope="col">Classified \ Reference</th><th scope="col">{referenceFlood}</th><th scope="col">{referenceOther}</th><th scope="col">Total</th><th scope="col">User's accuracy</th></tr></thead>
      <tbody>
        {rows.map(row => {
          const values = matrix.classified[row.key]!;
          return <tr key={row.key}><th scope="row">{row.label}</th><td>{count.format(values.reference_1)}</td><td>{count.format(values.reference_0)}</td><td>{count.format(values.total)}</td><td>{ratio(values.users_accuracy)}</td></tr>;
        })}
        <tr><th scope="row">Total</th><td>{count.format(matrix.reference_totals["1"]!)}</td><td>{count.format(matrix.reference_totals["0"]!)}</td><td>{count.format(matrix.reference_totals.all!)}</td><td /></tr>
        <tr><th scope="row">Producer's accuracy</th><td>{ratio(matrix.producers_accuracy["1"]!)}</td><td>{ratio(matrix.producers_accuracy["0"]!)}</td><td /><td /></tr>
      </tbody>
    </table></div>
  );
}

function ClassSummary({ scope }: { scope: Scope }) {
  return (
    <>
      <div className="accuracy-table-wrap"><table className="accuracy-table">
        <caption>Per-class accuracy summary</caption>
        <thead><tr>{["Class", "Area (ha)", "Omission error (%)", "Commission error (%)", "User's accuracy (%)", "Producer's accuracy (%)", "F1"].map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {scope.per_class.map(row => (
            <tr key={row.class_label}><th scope="row">{row.class_name}</th><td>{fixed(row.area_ha, 2)}</td><td>{fixed(row.omission_error_pct, 1)}</td><td>{fixed(row.commission_error_pct, 1)}</td><td>{fixed(row.users_accuracy_pct, 1)}</td><td>{fixed(row.producers_accuracy_pct, 1)}</td><td>{fixed(row.f1_score, 3)}</td></tr>
          ))}
        </tbody>
      </table></div>
      <p>Overall accuracy {fixed(scope.overall_accuracy_pct, 1)}% · Kappa {fixed(scope.cohens_kappa, 3)} · F1 (flood candidate) {fixed(scope.f1_flooded, 3)} · IoU {fixed(scope.iou_flooded, 3)}</p>
    </>
  );
}

const SIZE = 200;
const point = (x: number, y: number) => `${(x * SIZE).toFixed(1)},${((1 - y) * SIZE).toFixed(1)}`;

function Curve({ label, points, reference, referenceId, xLabel, yLabel, note }: { label: string; points: Array<[number, number]>; reference: string; referenceId: string; xLabel: string; yLabel: string; note: string }) {
  return (
    <figure className="accuracy-curve">
      <svg role="img" aria-label={label} viewBox={`-30 -10 ${SIZE + 40} ${SIZE + 40}`} width="100%" style={{ maxWidth: 320 }}>
        <rect x="0" y="0" width={SIZE} height={SIZE} fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <path data-testid={referenceId} d={reference} stroke="currentColor" strokeOpacity="0.5" strokeDasharray="4 4" fill="none" />
        <polyline points={points.map(([x, y]) => point(x, y)).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
        <text x={SIZE / 2} y={SIZE + 24} textAnchor="middle" fontSize="11">{xLabel}</text>
        <text x={-18} y={SIZE / 2} textAnchor="middle" fontSize="11" transform={`rotate(-90 -18 ${SIZE / 2})`}>{yLabel}</text>
      </svg>
      <figcaption>{note}</figcaption>
    </figure>
  );
}

function Curves({ scope }: { scope: Scope }) {
  const roc = scope.roc.filter(item => item.fpr !== null && item.tpr !== null).map(item => [item.fpr!, item.tpr!] as [number, number]);
  const pr = scope.pr.filter(item => item.recall !== null && item.precision !== null).map(item => [item.recall!, item.precision!] as [number, number]);
  const prevalence = scope.prevalence ?? 0;
  const positives = scope.n_per_reference_class["1"] ?? 0;
  const negatives = scope.n_per_reference_class["0"] ?? 0;
  return (
    <div className="accuracy-curves">
      <Curve label={`ROC curve, ${scope.title}`} points={roc} reference={`M ${point(0, 0)} L ${point(1, 1)}`} referenceId="diagonal"
        xLabel="False positive rate" yLabel="True positive rate"
        note={`AUC ${fixed(scope.roc_auc, 3)} · positives ${count.format(positives)} · negatives ${count.format(negatives)}`} />
      <Curve label={`Precision-recall curve, ${scope.title}`} points={pr} reference={`M ${point(0, prevalence)} L ${point(1, prevalence)}`} referenceId="prevalence"
        xLabel="Recall" yLabel="Precision" note={`AP ${fixed(scope.average_precision, 3)} · prevalence ${fixed(scope.prevalence, 3)}`} />
      <p className="notice">{scope.roc_auc_note}</p>
    </div>
  );
}

function Intervals({ scope }: { scope: Scope }) {
  const intervals = scope.confidence_intervals_95;
  if (!intervals) return <p>{scope.interval_note}</p>;
  const range = (value: number[] | null | undefined, digits: number, unit = "") => (value ? `${value[0]!.toFixed(digits)}–${value[1]!.toFixed(digits)}${unit}` : DASH);
  return <p>95% interval: OA {range(intervals.overall_accuracy_pct, 1, "%")} · Kappa {range(intervals.cohens_kappa, 3)} · AUC {range(intervals.roc_auc, 3)} ({intervals.method})</p>;
}

export function AccuracyAssessment({ assessment }: { assessment: Assessment }) {
  return (
    <section className="accuracy-assessment" aria-label="Accuracy assessment tables">
      {assessment.independent_status !== "assessed" ? (
        <p className="notice" role="status">Independent accuracy: {statusText[assessment.independent_status] ?? assessment.independent_status}.{assessment.independent_reason ? ` ${assessment.independent_reason}` : ""}</p>
      ) : null}
      {assessment.scopes.map(scope => (
        <article key={scope.scope} className="accuracy-scope">
          <h3>{scope.title}</h3>
          {scope.scope === "independent_optical" && assessment.independent_wording ? <p>{assessment.independent_wording}</p> : null}
          <p>Reference: {scope.reference_basis}. {scope.method === "census" ? `Census of n = ${count.format(scope.n)} eligible pixels.` : `Held-out sample, n = ${count.format(scope.n)}.`}</p>
          <ConfusionMatrix scope={scope} />
          <ClassSummary scope={scope} />
          <Intervals scope={scope} />
          <Curves scope={scope} />
        </article>
      ))}
    </section>
  );
}
