import type { components } from "../../shared/api/generated/nova-browser-api";
import { Disclosure } from "../../shared/ui/Disclosure";
import { AccuracyAssessment } from "./AccuracyAssessment";
import type { ResultArtifact } from "./gisViewer";
import { DeliveredMetadata } from "./QuantitativeDelivery";
import { protectedProductUrl } from "./resultsApi";
import { asRecord, confusionCells, COUNT, figure, fixed, independentScope, INDEPENDENT_STATUS_TEXT, internalScopes } from "./resultView";

type Result = components["schemas"]["ResultResponse"];
type Scope = components["schemas"]["AccuracyScope"];

const pct = (value: number | null | undefined) => { const text = fixed(value, 1); return text === null ? "—" : `${text}%`; };
const dec = (value: number | null | undefined) => fixed(value, 3) ?? "—";
const FALLBACK_AGREEMENT = "Metrics are internal agreement with the analysis labels — not independent flood-map accuracy.";

function classCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  return `n = ${entries.reduce((total, [, value]) => total + value, 0)} (${entries.map(([label, value]) => `class ${label}: ${value}`).join(", ")})`;
}

function ConfusionMatrix({ scope }: { scope: Scope }) {
  const cells = confusionCells(scope);
  const n = (value: number) => COUNT.format(value);
  return (
    <div className="fr-table-wrap"><table className="fr-matrix">
      <caption>Confusion matrix — rows: model classification · columns: Sentinel-2 reference (pixels)</caption>
      <thead><tr><td /><th scope="col">Reference flooded</th><th scope="col">Reference not flooded</th><th scope="col">Total</th><th scope="col">User's accuracy</th></tr></thead>
      <tbody>
        <tr><th scope="row">Model flooded</th><td><abbr title="true positives">TP</abbr> <span className="fr-num">{n(cells.tp)}</span></td><td><abbr title="false positives">FP</abbr> <span className="fr-num">{n(cells.fp)}</span></td><td className="fr-num">{n(cells.modelFlood)}</td><td className="fr-num">{pct(cells.usersFlood.pct)}</td></tr>
        <tr><th scope="row">Model not flooded</th><td><abbr title="false negatives">FN</abbr> <span className="fr-num">{n(cells.fn)}</span></td><td><abbr title="true negatives">TN</abbr> <span className="fr-num">{n(cells.tn)}</span></td><td className="fr-num">{n(cells.modelOther)}</td><td className="fr-num">{pct(cells.usersOther.pct)}</td></tr>
        <tr className="fr-matrix__total"><th scope="row">Total</th><td className="fr-num">{n(cells.referenceFlood)}</td><td className="fr-num">{n(cells.referenceOther)}</td><td className="fr-num">{n(cells.all)}</td><td /></tr>
        <tr className="fr-matrix__total"><th scope="row">Producer's accuracy</th><td className="fr-num">{pct(cells.producersFlood.pct)}</td><td className="fr-num">{pct(cells.producersOther.pct)}</td><td /><td /></tr>
      </tbody>
    </table></div>
  );
}

function PackageFigure({ artifact, resultId, caption }: { artifact: ResultArtifact | null; resultId: string; caption: string }) {
  if (!artifact) return null;
  return <figure className="fr-figure"><img src={protectedProductUrl(resultId, artifact.key)} alt={artifact.label} loading="lazy" /><figcaption>{caption}</figcaption></figure>;
}

export function ResultAccuracyTab({ data, artifacts }: { data: Result; artifacts: readonly ResultArtifact[] }) {
  const dashboard = data.validation_dashboard ?? null;
  const assessment = dashboard?.accuracy_assessment ?? null;
  const independent = independentScope(dashboard);
  const internal = internalScopes(dashboard);
  const summary = asRecord(data.summary);
  const provenance = asRecord(data.provenance);
  const independentRecord = asRecord(summary?.independent_accuracy);
  const audit = asRecord(independentRecord?.audit_sample);
  const auditPerClass = asRecord(audit?.per_class);
  const referenceRule = typeof asRecord(provenance?.optical_reference_policy)?.definition === "string" ? asRecord(provenance?.optical_reference_policy)!.definition as string : null;
  const opticalRole = asRecord(asRecord(provenance?.indices)?.mndwi)?.role;
  const status = assessment?.independent_status ?? dashboard?.independent_validation ?? (typeof asRecord(summary?.validation)?.independent_validation === "string" ? asRecord(summary?.validation)!.independent_validation as string : "not_performed");
  const statusText = INDEPENDENT_STATUS_TEXT[status] ?? status.replaceAll("_", " ");
  const referenceBasis = dashboard?.reference_basis ?? null;
  const limitations = Array.from(new Set([...(data.analytics?.limitations ?? []), ...(dashboard?.limitations ?? [])]));
  const cells = independent ? confusionCells(independent) : null;

  return <div className="fr-tab-stack">
    <h2 className="fr-visually-hidden">Accuracy assessment</h2>
    {independent && cells ? <>
      <section className="fr-card fr-section" aria-labelledby="accuracy-reference">
        <h3 id="accuracy-reference">Reference data</h3>
        {assessment?.independent_wording ? <p>{assessment.independent_wording}</p> : null}
        {referenceRule ? <p><strong>Reference rule:</strong> {referenceRule}</p> : null}
        {typeof opticalRole === "string" ? <p className="fr-help">Sentinel-2 role: {opticalRole}.</p> : null}
        <p>{typeof independentRecord?.method === "string" ? independentRecord.method.charAt(0).toUpperCase() + independentRecord.method.slice(1) : independent.method} · <span className="fr-num">n = {COUNT.format(independent.n)}</span> · IoU <span className="fr-num">{dec(independent.iou_flooded)}</span> · AP <span className="fr-num">{dec(independent.average_precision)}</span></p>
        {audit ? <p className="fr-audit" aria-label="Audit sample">
          <strong>Audit sample{auditPerClass ? ` (${Object.values(auditPerClass).map((value) => COUNT.format(Number(value))).join(" + ")} points)` : ""}:</strong>{" "}
          {typeof audit.wording === "string" ? audit.wording : typeof audit.purpose === "string" ? audit.purpose : null}
        </p> : null}
      </section>
      <section className="fr-metrics" aria-label="Accuracy metrics">
        {[["Overall accuracy", pct(independent.overall_accuracy_pct)], ["Cohen's Kappa", dec(independent.cohens_kappa)], ["F1 (flood class)", dec(independent.f1_flooded)],
          ["User's accuracy (flood)", pct(cells.usersFlood.pct)], ["Producer's accuracy (flood)", pct(cells.producersFlood.pct)], ["ROC AUC", dec(independent.roc_auc)]]
          .map(([label, value]) => <div className="fr-metric" key={label}><span>{label}</span><strong className="fr-num">{value}</strong></div>)}
      </section>
      <section className="fr-card fr-section" aria-labelledby="accuracy-matrix">
        <h3 id="accuracy-matrix">Confusion matrix</h3>
        <ConfusionMatrix scope={independent} />
        <p className="fr-help">{independent.interval_note}.</p>
      </section>
      <section className="fr-figures" aria-label="Accuracy figures">
        <PackageFigure resultId={data.id} artifact={figure(artifacts, "independent_optical", "roc")} caption={`ROC curve (AUC ${dec(independent.roc_auc)})`} />
        <PackageFigure resultId={data.id} artifact={figure(artifacts, "independent_optical", "pr")} caption={`Precision–recall curve (AP ${dec(independent.average_precision)})`} />
      </section>
      <Disclosure title="Per-class summary and curve data (independent reference)">
        <AccuracyAssessment assessment={{ ...assessment!, scopes: [independent] }} showStatus={false} />
      </Disclosure>
    </> : (
      <section className="fr-box fr-box--warning fr-not-assessable" aria-labelledby="accuracy-not-assessable">
        <h3 id="accuracy-not-assessable">Independent accuracy {statusText}</h3>
        {assessment?.independent_reason ? <p><strong>Reason:</strong> {assessment.independent_reason}</p> : null}
        <p>This analysis has no map-accuracy figures. The numbers below are internal agreement with the training labels — they are not map accuracy.</p>
      </section>
    )}

    <section className="fr-card fr-section fr-internal" aria-labelledby="accuracy-internal">
      <h3 id="accuracy-internal">Internal agreement <span className="fr-pill fr-pill--neutral">not map accuracy</span></h3>
      <p>{referenceBasis?.statement ?? FALLBACK_AGREEMENT}</p>
      <p className="fr-help">The SAR screening labels and the model share radar inputs, so agreement with those labels does not measure map accuracy. It is shown for transparency only{independent ? "; use the Sentinel-2 figures above for accuracy" : ""}.</p>
      <p>Independent validation: {status === "not_performed" ? "Not performed" : statusText.charAt(0).toUpperCase() + statusText.slice(1)}</p>
      {referenceBasis ? <dl className="metadata-list">
        <div><dt>Reference basis</dt><dd>{referenceBasis.label_source}</dd></div>
        {referenceBasis.rule ? <div><dt>Label rule</dt><dd>{referenceBasis.rule}</dd></div> : null}
        {referenceBasis.features_overlapping_rule.length ? <div><dt>Model features that also define the labels</dt><dd>{referenceBasis.features_overlapping_rule.join(", ")}</dd></div> : null}
        <div><dt>Split</dt><dd>{referenceBasis.split_method}</dd></div>
        <div><dt>Samples</dt><dd>Held-out {classCounts(referenceBasis.n_test_per_class)}; Training {classCounts(referenceBasis.n_train_per_class)}</dd></div>
      </dl> : null}
      {assessment && internal.length ? <Disclosure title="Internal agreement tables and curves"><AccuracyAssessment assessment={{ ...assessment, scopes: internal }} showStatus={false} /></Disclosure> : null}
      <h4>Internal agreement metrics</h4>
      {internal.length ? <>
        <ul className="fr-agreement">{internal.map((scope) => <li key={scope.scope}>
          {scope.method === "census" ? "Census" : "Held-out sample"}, <span className="fr-num">n = {COUNT.format(scope.n)}</span>: overall agreement <span className="fr-num">{pct(scope.overall_accuracy_pct)}</span> · Kappa <span className="fr-num">{dec(scope.cohens_kappa)}</span> · F1 <span className="fr-num">{dec(scope.f1_flooded)}</span>
        </li>)}</ul>
        <Disclosure title="All internal agreement values (as delivered)"><DeliveredMetadata value={asRecord(summary?.validation)} /></Disclosure>
      </> : <DeliveredMetadata value={asRecord(summary?.validation)} />}
    </section>

    <Disclosure title="Quality gate checks, dashboard and limitations">
      <h4>Quality gate checks</h4>
      <DeliveredMetadata value={asRecord(summary?.quality)} />
      {dashboard ? <><h4>Accuracy dashboard and availability</h4><DeliveredMetadata value={dashboard as unknown as Record<string, unknown>} /></> : null}
      <h4>Limitations</h4>
      {limitations.length ? <ul>{limitations.map((text) => <li key={text}>{text}</li>)}</ul> : <p>No validation limitations were supplied.</p>}
    </Disclosure>
  </div>;
}
