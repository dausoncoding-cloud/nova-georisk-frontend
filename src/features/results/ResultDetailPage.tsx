import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchAoi } from "../aois/aoisApi";
import { TaskArchive } from "../tasks/TaskArchive";
import { QuantitativeDelivery } from "./QuantitativeDelivery";
import { ExportCenter } from "./ExportCenter";
import { FIRRISGisViewer } from "./FIRRISGisViewer";
import { fetchResult } from "./resultsApi";

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function JsonMetadata({ value, empty = "No metadata supplied." }: { value: Record<string, unknown> | null; empty?: string }) {
  if (!value || Object.keys(value).length === 0) return <p className="muted-copy">{empty}</p>;
  return <dl className="metadata-list">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{typeof item === "object" && item !== null ? <code>{JSON.stringify(item)}</code> : String(item ?? "—")}</dd></div>)}</dl>;
}

export function ResultDetailPage() {
  const { resultId = "" } = useParams();
  const result = useQuery({ queryKey: queryKeys.results.detail(resultId), queryFn: () => fetchResult(resultId), enabled: Boolean(resultId) });
  const aoiId = result.data?.aoi_id ?? "";
  const aoi = useQuery({ queryKey: queryKeys.aois.detail(aoiId), queryFn: () => fetchAoi(aoiId), enabled: Boolean(aoiId) });

  if (result.isPending) return <LoadingState label="Loading result…" />;
  if (result.isError) return <ErrorState title="Result could not be loaded" error={result.error} onRetry={() => void result.refetch()} />;
  const data = result.data;
  const summary = asRecord(data.summary);
  const validation = asRecord(summary?.validation);
  const model = asRecord(summary?.model);
  const productMetadata = asRecord(summary?.products);
  const artifacts = [...data.products, ...data.exports];

  return <div className="page-stack">
    <header className="page-heading"><div><Link className="back-link" to={`/projects/${data.project_id}/results`}>← Analysis history</Link><span className="eyebrow">{data.engine_key} · result version {data.version}</span><h1>{data.result_type.replaceAll("_", " ")}</h1><p>Created {formatDate(data.created_at)} from task {data.task_id}.</p></div><Link className="button button--secondary" to={`/tasks/${data.task_id}`}>View task</Link></header>

    <section className="panel viewer-panel"><div className="panel-heading"><div><h2>FIRRIS GIS viewer</h2><p>Protected raster/vector display, AOI overlay, CRS checks, legends, and product comparison.</p></div><span className="count-badge">{data.layers.length}</span></div>{aoi.isPending ? <LoadingState label="Loading AOI boundary…" /> : null}{aoi.isError ? <div className="inline-alert" role="alert">The AOI boundary could not be loaded. Result layers remain available.</div> : null}{!aoi.isPending ? <FIRRISGisViewer resultId={data.id} layers={data.layers} artifacts={data.products} aoi={aoi.data ? { geometry: aoi.data.geometry, crs: aoi.data.crs, name: aoi.data.name } : null} /> : null}</section>

    <QuantitativeDelivery analytics={data.analytics} products={productMetadata} change={asRecord(summary?.change_statistics)} />
    <TaskArchive key={data.task_id} taskId={data.task_id} />
    <section className="result-exploration"><article className="panel metadata-panel"><div className="panel-heading"><div><h2>Product metadata</h2><p>Delivered products, units, extents, and summary statistics.</p></div></div><JsonMetadata value={productMetadata} empty="No product summary was persisted." /></article><article className="panel metadata-panel"><div className="panel-heading"><div><h2>Validation metrics</h2><p>Held-out accuracy assessment for this model run.</p></div></div><JsonMetadata value={validation} empty="This result does not contain model-validation metrics." />{model ? <details className="model-details"><summary>Model metadata</summary><JsonMetadata value={model} /></details> : null}</article><article className="panel metadata-panel"><div className="panel-heading"><div><h2>Provenance</h2><p>Data sources, processing lineage, and validation limitations.</p></div></div><JsonMetadata value={asRecord(data.provenance)} /></article></section>

    <ExportCenter resultId={data.id} artifacts={artifacts} />
  </div>;
}
