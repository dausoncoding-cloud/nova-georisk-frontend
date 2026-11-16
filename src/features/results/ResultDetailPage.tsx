import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FRRIS_ROUTES } from "../../app/routes";
import { queryKeys } from "../../shared/api/queryKeys";
import { displayEngineKey } from "../../shared/productName";
import { ErrorState } from "../../shared/ui/ErrorState";
import { Icon } from "../../shared/ui/Icon";
import { LoadingState } from "../../shared/ui/LoadingState";
import { WorkspaceTabs } from "../../shared/ui/WorkspaceTabs";
import { fetchAoi } from "../aois/aoisApi";
import { TaskArchive } from "../tasks/TaskArchive";
import { FIRRISGisViewer } from "./FIRRISGisViewer";
import { QuantitativeDelivery } from "./QuantitativeDelivery";
import { ResultAccuracyTab } from "./ResultAccuracyTab";
import { ResultDownloadsTab } from "./ResultDownloadsTab";
import { ResultOverviewTab } from "./ResultOverviewTab";
import { ResultProvenanceTab } from "./ResultProvenanceTab";
import { fetchResult, protectedProductUrl } from "./resultsApi";
import { asRecord, INDEPENDENT_STATUS_TEXT, radarSummary, resolutionMetres, resultPeriods } from "./resultView";

// The design's four sections first; the existing map viewer, metrics and execution archive stay available.
const tabs = [
  { key: "overview", label: "Overview" }, { key: "accuracy", label: "Accuracy assessment" },
  { key: "downloads", label: "Downloads & GIS layers" }, { key: "provenance", label: "Provenance" },
  { key: "maps", label: "Map viewer" }, { key: "metrics", label: "Metrics" }, { key: "execution", label: "Execution" },
] as const;
// Links from before the refresh (?tab=validation|files|metadata) open the matching section.
const TAB_ALIASES: Record<string, string> = { validation: "accuracy", files: "downloads", metadata: "provenance" };

export function ResultDetailPage() {
  const { resultId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") ?? "";
  const tab = tabs.find((item) => item.key === (TAB_ALIASES[requested] ?? requested))?.key ?? "overview";
  const result = useQuery({ queryKey: queryKeys.results.detail(resultId), queryFn: () => fetchResult(resultId), enabled: Boolean(resultId) });
  const aoiId = result.data?.aoi_id ?? "";
  const aoi = useQuery({ queryKey: queryKeys.aois.detail(aoiId), queryFn: () => fetchAoi(aoiId), enabled: Boolean(aoiId) });
  if (result.isPending) return <LoadingState label="Loading result…" />;
  if (result.isError) return <ErrorState title="Result could not be loaded" error={result.error} onRetry={() => void result.refetch()} />;

  const data = result.data;
  const summary = asRecord(data.summary);
  const products = asRecord(summary?.products);
  const provenance = asRecord(data.provenance);
  const artifacts = Array.from(new Map([...data.products, ...data.exports].map((item) => [item.key, item])).values());
  const firstLayer = data.layers.find((layer) => layer.renderable);
  const periods = resultPeriods(data);
  const radar = radarSummary(provenance);
  const scale = resolutionMetres(provenance);
  const reports = ["scientific_report_word", "scientific_report_pdf"].map((key) => artifacts.find((item) => item.key === key)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const assessment = data.validation_dashboard?.accuracy_assessment ?? null;
  const title = aoi.data?.name ?? data.result_type.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
  const navigateTab = (key: string) => { const next = new URLSearchParams(params); next.set("tab", key); setParams(next); };
  const meta = [periods.target ? `Target ${periods.target}` : null, periods.baseline ? `Baseline ${periods.baseline}` : null, radar, scale ? `${scale} m` : null].filter(Boolean);

  const viewer = (preview: boolean) => <section className="fr-card fr-section viewer-panel">
    <div className="fr-section__head"><h3>{preview ? "Primary map" : "Map viewer"}</h3>{preview ? <button type="button" className="fr-link-button" onClick={() => navigateTab("maps")}>Explore maps</button> : null}</div>
    {aoiId && aoi.isPending ? <LoadingState label="Loading AOI boundary…" /> : null}
    {aoi.isError ? <div className="fr-box fr-box--danger" role="alert">The AOI boundary could not be loaded. Result layers remain available.</div> : null}
    {(!aoiId || !aoi.isPending) ? <FIRRISGisViewer key={`${data.id}-${preview}`} compact={preview} resultId={data.id} layers={preview ? firstLayer ? [firstLayer] : [] : data.layers} artifacts={data.products} aoi={aoi.data ? { geometry: aoi.data.geometry, crs: aoi.data.crs, name: aoi.data.name } : null} /> : null}
  </section>;

  return <div className="fr-result result-workspace">
    <header className="fr-result__header">
      <Link className="fr-back" to={FRRIS_ROUTES.analyses}>← Analyses</Link>
      <div className="fr-result__title">
        <div>
          <span className="fr-overline">{displayEngineKey(data.engine_key)} · result version {data.version}</span>
          <h1>{title}</h1>
        </div>
        <div className="fr-page-header__actions">
          {reports.map((report) => <a key={report.key} className="fr-button fr-button--secondary" href={protectedProductUrl(data.id, report.key)}>
            <Icon name="reports" width={16} height={16} strokeWidth={2} />{report.format === "docx" ? "Report (Word)" : "Report (PDF)"}</a>)}
          <Link className="fr-button fr-button--secondary" to={`/tasks/${data.task_id}`}>View task</Link>
        </div>
      </div>
      {meta.length ? <p className="fr-result__meta">{meta.join(" · ")}</p> : null}
      <Link className="fr-result__project" to={`/projects/${data.project_id}/results`}>Project results</Link>
    </header>
    {data.interpretation_notice ? <p className="fr-box fr-box--warning" role="status" aria-label="Interpretation notice">{data.interpretation_notice}</p> : null}
    {assessment?.independent_status === "assessed" && assessment.independent_wording
      ? <p className="fr-box fr-box--info" role="note" aria-label="Accuracy basis"><Icon name="check" width={18} height={18} strokeWidth={2} />The flood-candidate extent is model-classified from Sentinel-1 radar. {assessment.independent_wording}</p>
      : assessment && assessment.independent_status !== "assessed"
        ? <p className="fr-box fr-box--warning" role="note" aria-label="Accuracy basis"><Icon name="warning" width={18} height={18} strokeWidth={2} /><span><strong>Independent accuracy {INDEPENDENT_STATUS_TEXT[assessment.independent_status] ?? assessment.independent_status}.</strong>{assessment.independent_reason ? ` ${assessment.independent_reason.replace(/[.!?]?$/, ".")}` : ""} No map-accuracy figures are available for this analysis.</span></p>
        : null}
    <WorkspaceTabs tabs={tabs} value={tab} onChange={navigateTab} label="Result sections">
      {tab === "overview" ? <ResultOverviewTab data={data} artifacts={artifacts} aoiName={aoi.data?.name ?? null} viewer={viewer(true)} onOpenTab={navigateTab} /> : null}
      {tab === "accuracy" ? <ResultAccuracyTab data={data} artifacts={artifacts} /> : null}
      {tab === "downloads" ? <ResultDownloadsTab resultId={data.id} artifacts={artifacts} createdAt={data.created_at} /> : null}
      {tab === "provenance" ? <ResultProvenanceTab data={data} /> : null}
      {tab === "maps" ? viewer(false) : null}
      {tab === "metrics" ? <QuantitativeDelivery analytics={data.analytics} products={products} change={asRecord(summary?.change_statistics)} /> : null}
      {tab === "execution" ? <TaskArchive key={data.task_id} taskId={data.task_id} /> : null}
    </WorkspaceTabs>
  </div>;
}
