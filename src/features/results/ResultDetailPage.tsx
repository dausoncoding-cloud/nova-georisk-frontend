import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { Disclosure } from "../../shared/ui/Disclosure";
import { WorkspaceTabs } from "../../shared/ui/WorkspaceTabs";
import { fetchAoi } from "../aois/aoisApi";
import { TaskArchive } from "../tasks/TaskArchive";
import { DeliveredMetadata, deliveredValue, QuantitativeDelivery } from "./QuantitativeDelivery";
import { ExportCenter } from "./ExportCenter";
import { FIRRISGisViewer } from "./FIRRISGisViewer";
import { fetchResult, protectedProductUrl } from "./resultsApi";

const tabs = [
  { key: "overview", label: "Overview" }, { key: "maps", label: "Maps" },
  { key: "metrics", label: "Metrics" }, { key: "files", label: "Data & Files" },
  { key: "validation", label: "Validation" }, { key: "execution", label: "Execution" },
  { key: "metadata", label: "Metadata" },
] as const;
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function ResultDetailPage() {
  const { resultId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = tabs.find(item => item.key === params.get("tab"))?.key ?? "overview";
  const result = useQuery({ queryKey: queryKeys.results.detail(resultId), queryFn: () => fetchResult(resultId), enabled: Boolean(resultId) });
  const aoiId = result.data?.aoi_id ?? "";
  const aoi = useQuery({ queryKey: queryKeys.aois.detail(aoiId), queryFn: () => fetchAoi(aoiId), enabled: Boolean(aoiId) });
  if (result.isPending) return <LoadingState label="Loading result…" />;
  if (result.isError) return <ErrorState title="Result could not be loaded" error={result.error} onRetry={() => void result.refetch()} />;
  const data = result.data;
  const summary = asRecord(data.summary);
  const quality = asRecord(summary?.quality);
  const validation = asRecord(summary?.validation);
  const provenance = asRecord(data.provenance);
  const products = asRecord(summary?.products);
  const artifacts = Array.from(new Map([...data.products, ...data.exports].map(item => [item.key, item])).values());
  const packageFile = artifacts.find(item => item.artifact_type === "package");
  const firstLayer = data.layers.find(layer => layer.renderable);
  const targetPeriod = asRecord(provenance?.target_period);
  const period = targetPeriod ? `${deliveredValue(targetPeriod.start)} → ${deliveredValue(targetPeriod.end)}` : "Not supplied";
  const limitations = Array.from(new Set([...(data.analytics?.limitations ?? []), ...(data.validation_dashboard?.limitations ?? [])]));
  const navigateTab = (key: string) => { const next = new URLSearchParams(params); next.set("tab", key); setParams(next); };
  const viewer = (preview: boolean) => <section className={`panel viewer-panel${preview ? " viewer-panel--preview" : ""}`}>
    <div className="panel-heading"><h2>{preview ? "Primary map" : "Map workspace"}</h2>{preview ? <button className="button button--quiet button--small" onClick={() => navigateTab("maps")}>Explore maps</button> : <span className="count-badge">{data.layers.length}</span>}</div>
    {aoiId && aoi.isPending ? <LoadingState label="Loading AOI boundary…" /> : null}
    {aoi.isError ? <div className="inline-alert" role="alert">The AOI boundary could not be loaded. Result layers remain available.</div> : null}
    {(!aoiId || !aoi.isPending) ? <FIRRISGisViewer key={`${data.id}-${preview}`} compact={preview} resultId={data.id} layers={preview ? firstLayer ? [firstLayer] : [] : data.layers} artifacts={data.products} aoi={aoi.data ? { geometry: aoi.data.geometry, crs: aoi.data.crs, name: aoi.data.name } : null} /> : null}
  </section>;

  return <div className="page-stack result-workspace">
    <header className="page-heading"><div><Link className="back-link" to={`/projects/${data.project_id}/results`}>← Project results</Link><span className="eyebrow">{data.engine_key} · version {data.version}</span><h1>{data.result_type.replaceAll("_", " ")}</h1><p>Created {formatDate(data.created_at)}</p></div><div className="form-actions"><Link className="button button--secondary" to={`/tasks/${data.task_id}`}>View task</Link>{packageFile ? <a className="button button--primary" href={protectedProductUrl(data.id, packageFile.key)}>Download package</a> : <button className="button button--secondary" onClick={() => navigateTab("files")}>View files</button>}</div></header>
    <dl className="result-summary" aria-label="Result summary"><div><dt>Execution status</dt><dd>{typeof summary?.status === "string" ? summary.status : "Not supplied"}</dd></div><div><dt>AOI</dt><dd>{aoi.data?.name ?? (aoiId ? aoi.isError ? "Boundary unavailable" : "Loading…" : "Not supplied")}</dd></div><div><dt>Analysis period</dt><dd>{period}</dd></div><div><dt>Quality gate</dt><dd>{typeof quality?.status === "string" ? quality.status : "Not supplied"}</dd></div></dl>
    <WorkspaceTabs tabs={tabs} value={tab} onChange={navigateTab} label="Result workspace">
      {tab === "overview" ? <div className="page-stack">
        <dl className="result-summary result-summary--inline" aria-label="Delivered output summary"><div><dt>Outputs</dt><dd>{artifacts.length} file{artifacts.length === 1 ? "" : "s"} · {data.layers.length} map layer{data.layers.length === 1 ? "" : "s"}</dd></div><div><dt>CRS</dt><dd>{firstLayer?.crs ?? "Not supplied"}</dd></div><div><dt>Independent validation</dt><dd>{typeof validation?.independent_validation === "string" ? validation.independent_validation : "Not supplied"}</dd></div></dl>
        {data.analytics?.class_areas?.length ? <section className="panel content-panel"><h2>Key class areas</h2><div className="table-wrap"><table><thead><tr><th>Product / class</th><th>Area (km²)</th><th>% of valid area</th></tr></thead><tbody>{data.analytics.class_areas.slice(0, 3).map((row, index) => <tr key={index}><td>{row.product_key} · {row.label}</td><td>{deliveredValue(row.area_km2)}</td><td>{deliveredValue(row.percent_of_valid)}</td></tr>)}</tbody></table></div><button className="button button--quiet button--small" onClick={() => navigateTab("metrics")}>All metrics and evidence</button></section> : null}
        {limitations.length ? <div className="notice" role="note"><strong>Limitations</strong><ul>{limitations.slice(0, 3).map(text => <li key={text}>{text}</li>)}</ul>{limitations.length > 3 ? <button className="button button--quiet button--small" onClick={() => navigateTab("validation")}>View all limitations ({limitations.length})</button> : null}</div> : null}
        {quality?.status === "failed" ? <div className="inline-alert" role="alert">The scientific quality gate failed. Review the delivered checks in Validation before using this result.</div> : null}
        {viewer(true)}
      </div> : null}
      {tab === "maps" ? viewer(false) : null}
      {tab === "metrics" ? <QuantitativeDelivery analytics={data.analytics} products={products} change={asRecord(summary?.change_statistics)} /> : null}
      {tab === "files" ? <ExportCenter resultId={data.id} artifacts={artifacts} createdAt={data.created_at} /> : null}
      {tab === "validation" ? <section className="panel content-panel"><h2>Scientific validation</h2><p className="notice">Quality gate approval and held-out accuracy do not establish independent scientific validation.</p><h3>Quality gate checks</h3><DeliveredMetadata value={quality} /><h3>Validation metrics</h3><DeliveredMetadata value={validation} />{data.validation_dashboard ? <Disclosure title="Accuracy dashboard and availability"><DeliveredMetadata value={data.validation_dashboard as unknown as Record<string, unknown>} /></Disclosure> : null}<h3>Limitations</h3>{limitations.length ? <ul>{limitations.map(text => <li key={text}>{text}</li>)}</ul> : <p>No validation limitations were supplied.</p>}</section> : null}
      {tab === "execution" ? <TaskArchive key={data.task_id} taskId={data.task_id} /> : null}
      {tab === "metadata" ? <section className="panel content-panel"><h2>Metadata & provenance</h2><h3>Spatial and temporal reference</h3>{data.layers.map(layer => <Disclosure title={layer.label} key={layer.key}><DeliveredMetadata value={{ crs: layer.crs, resolution: layer.spatial_resolution, bounds: layer.bounding_box, acquisition: layer.temporal_metadata, units: layer.units, nodata: layer.nodata }} /></Disclosure>)}<Disclosure title="Source datasets and processing provenance"><DeliveredMetadata value={provenance} /></Disclosure><Disclosure title="Model configuration"><DeliveredMetadata value={asRecord(summary?.model)} /></Disclosure><Disclosure title="Product metadata"><DeliveredMetadata value={products} /></Disclosure><Disclosure title="Raw result summary"><pre>{JSON.stringify(summary, null, 2)}</pre></Disclosure></section> : null}
    </WorkspaceTabs>
  </div>;
}
