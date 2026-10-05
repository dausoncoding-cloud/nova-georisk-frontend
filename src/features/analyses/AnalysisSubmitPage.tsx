import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getErrorMessage } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProjectAois } from "../aois/aoisApi";
import { getGeometryBoundingBox } from "../aois/geometry";
import { useAvailableEngines, useEngineContract } from "../engines/engineQueries";
import { fetchProject } from "../projects/projectsApi";
import { submitAnalysis, type FirrisProduct } from "./analysisApi";
import { buildGeeSatelliteWorkflowParameters, defaultSatelliteWorkflowForm, type SatelliteWorkflowForm } from "./parameters";

const steps = ["Context", "AOI", "Period", "Data", "Preprocess", "Sampling", "Products", "Validation", "Review"];
const productKeys = new Set<string>(["flood_extent", "flood_depth", "flood_velocity", "flood_hazard", "flood_probability", "flood_duration", "flood_exposure", "flood_vulnerability", "flood_risk", "flood_susceptibility", "flood_hazard_zonation"]);

export function AnalysisSubmitPage() {
  const { projectId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const project = useQuery({ queryKey: queryKeys.projects.detail(projectId), queryFn: () => fetchProject(projectId), enabled: Boolean(projectId) });
  const aois = useQuery({ queryKey: queryKeys.aois.project(projectId), queryFn: () => fetchProjectAois(projectId), enabled: Boolean(projectId) });
  const engines = useAvailableEngines();
  const firris = useMemo(() => (engines.data ?? []).find((engine) => engine.name.trim().toUpperCase() === "FIRRIS" && engine.access !== false), [engines.data]);
  const contract = useEngineContract(firris?.key ?? null);
  const [step, setStep] = useState(0);
  const [aoiId, setAoiId] = useState(searchParams.get("aoi_id") ?? "");
  const [products, setProducts] = useState<FirrisProduct[]>([]);
  const [configuration, setConfiguration] = useState<SatelliteWorkflowForm>(() => ({ ...defaultSatelliteWorkflowForm }));
  const [error, setError] = useState<string | null>(null);
  const { targetStart, targetEnd, baselineStart, baselineEnd, maxCloudPct, scale, sampleSize, samplingStrategy, trainFraction, cloudMask, sarSpeckleFilter: sarFilter, normalizeProjection: normalize } = configuration;
  const configure = <Key extends keyof SatelliteWorkflowForm>(key: Key, value: SatelliteWorkflowForm[Key]) => setConfiguration((current) => ({ ...current, [key]: value }));
  const setTargetStart = (value: string) => configure("targetStart", value);
  const setTargetEnd = (value: string) => configure("targetEnd", value);
  const setBaselineStart = (value: string) => configure("baselineStart", value);
  const setBaselineEnd = (value: string) => configure("baselineEnd", value);
  const setMaxCloudPct = (value: number) => configure("maxCloudPct", value);
  const setScale = (value: number) => configure("scale", value);
  const setSampleSize = (value: number) => configure("sampleSize", value);
  const setSamplingStrategy = (value: SatelliteWorkflowForm["samplingStrategy"]) => configure("samplingStrategy", value);
  const setTrainFraction = (value: number) => configure("trainFraction", value);
  const setCloudMask = (value: boolean) => configure("cloudMask", value);
  const setSarFilter = (value: boolean) => configure("sarSpeckleFilter", value);
  const setNormalize = (value: boolean) => configure("normalizeProjection", value);

  useEffect(() => { if (!aoiId && aois.data?.items[0]) setAoiId(aois.data.items[0].id); }, [aoiId, aois.data]);
  const availableProducts = useMemo(() => (contract.data?.products ?? []).filter((item) => productKeys.has(item.key)), [contract.data]);
  const selectedAoi = aois.data?.items.find((item) => item.id === aoiId);
  const enabledSatelliteProducts = new Set(["flood_extent", "flood_probability"]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!selectedAoi || !project.data || !firris) throw new Error("Project, engine and AOI are required.");
      if (project.data.engine_key !== firris.key) throw new Error("This project is not configured for the entitled FIRRIS engine.");
      if (!products.length) throw new Error("Select at least one production-ready product.");
      const parameters = buildGeeSatelliteWorkflowParameters(configuration);
      return submitAnalysis({ project_id: projectId, aoi_id: selectedAoi.id, operation: "flood_mapping", products, parameters, gis_metadata: { crs: selectedAoi.crs, bounding_box: getGeometryBoundingBox(selectedAoi.geometry), spatial_resolution: { x: scale, y: scale, unit: "m" }, acquisition_date: targetEnd, producer: "NOVA GeoRisk", engine_version: contract.data?.engine_version ?? null } });
    },
    onSuccess: (response) => navigate(`/tasks/${response.task.task_id}`),
    onError: (caught) => setError(getErrorMessage(caught)),
  });

  function next() {
    setError(null);
    if (step === 1 && !selectedAoi) return setError("Select an area of interest.");
    if (step === 2 && (targetStart >= targetEnd || baselineStart >= baselineEnd)) return setError("Each start date must be before its end date.");
    if (step === 6 && products.length === 0) return setError("Select at least one production-ready product.");
    setStep((value) => Math.min(8, value + 1));
  }

  if (project.isPending || aois.isPending || engines.isPending) return <LoadingState label="Preparing FIRRIS analysis builder…" />;
  if (project.isError) return <ErrorState title="Project could not be loaded" error={project.error} />;
  if (aois.isError) return <ErrorState title="Areas of interest could not be loaded" error={aois.error} />;
  if (engines.isError) return <ErrorState title="Engine access could not be loaded" error={engines.error} />;
  if (!firris) return <ErrorState title="FIRRIS is unavailable" error={new Error("This organization does not have an active FIRRIS entitlement.")} />;

  return <div className="analysis-builder">
    <header className="section-heading"><div><span className="eyebrow">Guided workflow</span><h2>New FIRRIS analysis</h2><p>Configure an auditable satellite flood analysis without exposing internal processing payloads.</p></div><span className="engine-pill">FIRRIS · {firris.version}</span></header>
    <ol className="analysis-stepper">{steps.map((label, index) => <li key={label} className={index === step ? "is-active" : index < step ? "is-done" : ""} onClick={() => index < step && setStep(index)}><span>{index < step ? "✓" : index + 1}</span><small>{label}</small></li>)}</ol>
    <div className="analysis-builder__layout"><section className="panel builder-panel">
      {step === 0 ? <div className="builder-step"><span className="eyebrow">Step 1 of 9</span><h3>Confirm project context</h3><p>Analyses inherit the project’s engine and tenant authorization.</p><dl className="review-facts"><div><dt>Project</dt><dd>{project.data.name}</dd></div><div><dt>Organization</dt><dd>{project.data.organization_id}</dd></div><div><dt>Engine</dt><dd>{project.data.engine_key.toUpperCase()}</dd></div><div><dt>Project CRS</dt><dd>{project.data.crs}</dd></div></dl></div> : null}
      {step === 1 ? <div className="builder-step"><span className="eyebrow">Step 2 of 9</span><h3>Select area of interest</h3><p>Only AOIs from this project are available.</p><div className="selection-list">{aois.data.items.map((aoi) => <label className={aoiId === aoi.id ? "is-selected" : ""} key={aoi.id}><input type="radio" name="aoi" checked={aoiId === aoi.id} onChange={() => setAoiId(aoi.id)} /><span><strong>{aoi.name}</strong><small>{aoi.geometry.type} · {aoi.stats.area_km2.toFixed(2)} km² · {aoi.crs}</small></span></label>)}</div>{aois.data.items.length === 0 ? <div className="empty-state"><p>No AOIs available.</p><Link className="button button--primary" to={`/projects/${projectId}/aois`}>Create AOI</Link></div> : null}</div> : null}
      {step === 2 ? <div className="builder-step"><span className="eyebrow">Step 3 of 9</span><h3>Analysis period</h3><p>Choose the target event window and a comparable baseline period.</p><div className="date-period"><fieldset><legend>Target period</legend><label className="field"><span>Start</span><input type="date" value={targetStart} onChange={(event) => setTargetStart(event.target.value)} /></label><label className="field"><span>End</span><input type="date" value={targetEnd} onChange={(event) => setTargetEnd(event.target.value)} /></label></fieldset><fieldset><legend>Baseline period</legend><label className="field"><span>Start</span><input type="date" value={baselineStart} onChange={(event) => setBaselineStart(event.target.value)} /></label><label className="field"><span>End</span><input type="date" value={baselineEnd} onChange={(event) => setBaselineEnd(event.target.value)} /></label></fieldset></div></div> : null}
      {step === 3 ? <div className="builder-step"><span className="eyebrow">Step 4 of 9</span><h3>Satellite data</h3><p>The FIRRIS production pipeline requires this reviewed dataset combination.</p><div className="dataset-selection">{[["Sentinel-1 GRD", "SAR flood signal"], ["Sentinel-2 SR", "Optical quality features"], ["CHIRPS Daily", "Rainfall context"], ["SRTM / ALOS", "Terrain features"], ["JRC Surface Water", "Permanent-water context"]].map(([name, use]) => <div key={name}><span>✓</span><strong>{name}</strong><small>{use}</small></div>)}</div><label className="field field--compact"><span>Maximum optical cloud cover</span><input type="number" min="0" max="100" value={maxCloudPct} onChange={(event) => setMaxCloudPct(Number(event.target.value))} /><small>percent</small></label></div> : null}
      {step === 4 ? <div className="builder-step"><span className="eyebrow">Step 5 of 9</span><h3>Preprocessing</h3><p>Configure supported quality and normalization operations.</p><div className="toggle-list">{[["Cloud and quality mask", cloudMask, setCloudMask], ["SAR speckle filtering", sarFilter, setSarFilter], ["Projection normalization", normalize, setNormalize]].map(([label, checked, setter]) => <label key={String(label)}><span><strong>{String(label)}</strong><small>Applied server-side and recorded in provenance.</small></span><input type="checkbox" role="switch" checked={Boolean(checked)} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} /></label>)}</div><div className="notice">AOI clipping is always enforced by the engine and cannot be disabled.</div></div> : null}
      {step === 5 ? <div className="builder-step">
        <span className="eyebrow">Step 6 of 9</span><h3>Sampling framework</h3>
        <p>Choose a sampling method and the training/testing split.</p>
        <div className="form-row">
          <label className="field"><span>Method</span><select value={samplingStrategy} onChange={(event) => setSamplingStrategy(event.target.value as SatelliteWorkflowForm["samplingStrategy"])}><option value="stratified_random">Stratified random (recommended)</option><option value="simple_random">Simple random</option></select></label>
          <label className="field"><span>Sample size</span><input type="number" min="10" max="1000000" value={sampleSize} onChange={(event) => setSampleSize(Number(event.target.value))} /></label>
          <label className="field"><span>Training fraction</span><input type="number" min=".5" max=".99" step=".05" value={trainFraction} onChange={(event) => setTrainFraction(Number(event.target.value))} /></label>
        </div>
        <div className="notice">The remaining {(100 - trainFraction * 100).toFixed(0)}% is reserved for validation. The worker rejects simple-random samples that fail the minimum per-class count.</div>
      </div> : null}
      {step === 6 ? <div className="builder-step"><span className="eyebrow">Step 7 of 9</span><h3>Select products</h3><p>Only products with an available satellite delivery type can be submitted.</p><div className="product-grid">{availableProducts.map((product) => { const ready = product.available_delivery_types.length > 0 && enabledSatelliteProducts.has(product.key); const checked = products.includes(product.key as FirrisProduct); return <label className={`product-option${checked ? " product-option--selected" : ""}${!ready ? " product-option--disabled" : ""}`} key={product.key}><input type="checkbox" disabled={!ready} checked={checked} onChange={() => setProducts((current) => checked ? current.filter((key) => key !== product.key) : [...current, product.key as FirrisProduct])} /><span><strong>{product.label}</strong><small>{ready ? product.available_delivery_types.join(" · ") : `Planned · ${product.planned_delivery_types.join(" · ") || "delivery unavailable"}`}</small></span></label>; })}</div></div> : null}
      {step === 7 ? <div className="builder-step"><span className="eyebrow">Step 8 of 9</span><h3>Validation and output</h3><p>Confirm the model baseline and requested spatial resolution.</p><div className="model-card"><div><span className="engine-pill">Baseline</span><h4>Random Forest</h4><p>Versioned model metadata, confusion matrix and accuracy metrics are persisted with the result.</p></div><label className="field"><span>Output scale</span><input type="number" min="1" max="1000" value={scale} onChange={(event) => setScale(Number(event.target.value))} /><small>metres</small></label></div><div className="notice">The SAR screening mask is used as a pseudo-label in the current baseline. Independent field labels remain necessary for authoritative validation.</div></div> : null}
      {step === 8 ? <div className="builder-step"><span className="eyebrow">Step 9 of 9</span><h3>Review and submit</h3><p>Submission creates a persistent task and dispatches it to the protected worker queue.</p><dl className="review-facts"><div><dt>Project</dt><dd>{project.data.name}</dd></div><div><dt>AOI</dt><dd>{selectedAoi?.name}</dd></div><div><dt>Target</dt><dd>{targetStart} → {targetEnd}</dd></div><div><dt>Baseline</dt><dd>{baselineStart} → {baselineEnd}</dd></div><div><dt>Products</dt><dd>{products.map((item) => item.replaceAll("_", " ")).join(", ")}</dd></div><div><dt>Sampling</dt><dd>{samplingStrategy.replaceAll("_", " ")} · {sampleSize.toLocaleString()} · {(trainFraction * 100).toFixed(0)}% training</dd></div><div><dt>Resolution</dt><dd>{scale} m</dd></div><div><dt>Outputs</dt><dd>Protected GIS products, validation and report package</dd></div></dl></div> : null}
      {error ? <div className="inline-alert" role="alert">{error}</div> : null}
      <footer className="builder-actions"><button className="button button--quiet" type="button" onClick={() => step === 0 ? navigate(`/projects/${projectId}`) : setStep((value) => value - 1)}>{step === 0 ? "Cancel" : "Back"}</button>{step < 8 ? <button className="button button--primary" type="button" onClick={next}>Continue</button> : <button className="button button--primary" type="button" disabled={submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? "Submitting…" : "Submit FIRRIS analysis"}</button>}</footer>
    </section><aside className="analysis-summary"><span className="eyebrow">Run summary</span><dl><div><dt>Engine</dt><dd>FIRRIS {firris.version}</dd></div><div><dt>AOI</dt><dd>{selectedAoi?.name ?? "Not selected"}</dd></div><div><dt>Products</dt><dd>{products.length}</dd></div><div><dt>Output scale</dt><dd>{scale} m</dd></div></dl><div className="secure-note"><strong>Protected execution</strong><p>Credentials, provider tokens and internal service secrets remain server-side.</p></div></aside></div>
  </div>;
}
