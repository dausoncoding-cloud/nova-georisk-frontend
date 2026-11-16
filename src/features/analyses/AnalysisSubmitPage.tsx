import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FRRIS_ROUTES } from "../../app/routes";
import { describeApiError } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { FRRIS_ENGINE_KEY } from "../../shared/productName";
import { Disclosure } from "../../shared/ui/Disclosure";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProjectAois } from "../aois/aoisApi";
import { AoiWizard } from "../aois/AoiWizard";
import { getGeometryBoundingBox } from "../aois/geometry";
import { useAvailableEngines, useEngineContract } from "../engines/engineQueries";
import { fetchProject, fetchProjects } from "../projects/projectsApi";
import { preflightAnalysis, submitAnalysis, type AnalysisSubmitRequest, type FirrisProduct } from "./analysisApi";
import { buildGeeSatelliteWorkflowParameters, defaultSatelliteWorkflowForm, FIXED_RUN_SETTINGS, type SatelliteWorkflowForm } from "./parameters";
import { periodProblem, SENTINEL1_START, todayIso, toApiEnd, toLastDay, formatPeriod, type InclusivePeriod } from "./periods";
import { downloadSizeText, MIB, PreflightPanel } from "./PreflightPanel";

const PRODUCT_KEYS = new Set<string>(["flood_extent", "flood_depth", "flood_velocity", "flood_hazard", "flood_probability", "flood_duration", "flood_exposure", "flood_vulnerability", "flood_risk", "flood_susceptibility", "flood_hazard_zonation"]);
const SATELLITE_PRODUCTS = new Set(["flood_extent", "flood_probability"]);
const DEFAULT_PRODUCT: FirrisProduct = "flood_extent";
export const NO_PRODUCT_MESSAGE = "Select at least one product (step 4).";
const FEATURE_LABELS: Record<string, string> = { sar_vv_target: "SAR VV (target)", sar_change: "SAR change", elevation: "Elevation", slope: "Slope", rainfall: "Rainfall (CHIRPS)" };

/** Form state in UI terms: windows end on an inclusive last day (backlog §4.7 item 1). */
export type BuilderForm = Omit<SatelliteWorkflowForm, "targetEnd" | "baselineEnd"> & { targetLast: string; baselineLast: string };

export const defaultBuilderForm: BuilderForm = (() => {
  const { targetEnd, baselineEnd, ...rest } = defaultSatelliteWorkflowForm;
  return { ...rest, targetLast: toLastDay(targetEnd), baselineLast: toLastDay(baselineEnd) };
})();

/** UI form → API form: the only change is the +1 day on each end date. */
export function toApiForm(form: BuilderForm): SatelliteWorkflowForm {
  const { targetLast, baselineLast, ...rest } = form;
  return { ...rest, targetEnd: toApiEnd(targetLast), baselineEnd: toApiEnd(baselineLast) };
}

function Step({ number, title, children, id }: { number: number; title: string; children: ReactNode; id: string }) {
  return (
    <section className="fr-card fr-step" aria-labelledby={id}>
      <div className="fr-step__head"><span className="fr-step__number" aria-hidden="true">{number}</span><h2 id={id}><span className="fr-visually-hidden">Step {number}: </span>{title}</h2></div>
      {children}
    </section>
  );
}

export function AnalysisSubmitPage({ embedded = false }: { embedded?: boolean }) {
  const { projectId: routeProjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idBase = useId();
  const [chosenProjectId, setChosenProjectId] = useState(searchParams.get("project") ?? "");
  const projects = useQuery({ queryKey: queryKeys.projects.all, queryFn: fetchProjects, enabled: !routeProjectId });
  const frrisProjects = useMemo(() => (projects.data ?? []).filter((item) => item.engine_key === FRRIS_ENGINE_KEY), [projects.data]);
  const projectId = routeProjectId ?? (chosenProjectId || frrisProjects[0]?.id || "");
  const project = useQuery({ queryKey: queryKeys.projects.detail(projectId), queryFn: () => fetchProject(projectId), enabled: Boolean(projectId) });
  const aois = useQuery({ queryKey: queryKeys.aois.project(projectId), queryFn: () => fetchProjectAois(projectId), enabled: Boolean(projectId) });
  const engines = useAvailableEngines();
  const firris = useMemo(() => (engines.data ?? []).find((engine) => engine.key === FRRIS_ENGINE_KEY && engine.access !== false), [engines.data]);
  const contract = useEngineContract(firris?.key ?? null);
  const [aoiId, setAoiId] = useState(searchParams.get("aoi_id") ?? "");
  // r5.1: the flood-candidate extent is selected by default. `null` means "the default"; the user's own choice
  // (including none) is kept as an explicit list and survives project, AOI and date changes.
  const [chosenProducts, setProducts] = useState<FirrisProduct[] | null>(null);
  // ?scale= from the area playground ("Use 60 m resolution"); any other value keeps the 30 m default.
  const [form, setForm] = useState<BuilderForm>(() => {
    const scale = Number(searchParams.get("scale"));
    return { ...defaultBuilderForm, ...(Number.isFinite(scale) && scale >= 1 && scale <= 1000 && searchParams.has("scale") ? { scale } : {}) };
  });
  const [problems, setProblems] = useState<string[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const knownAoiIds = useRef<Set<string> | null>(null);
  const configure = <Key extends keyof BuilderForm>(key: Key, value: BuilderForm[Key]) => setForm((current) => ({ ...current, [key]: value }));
  const today = todayIso();

  // Keep a valid AOI selected; after "Draw or upload", select the area that was just created.
  useEffect(() => {
    const items = aois.data?.items ?? [];
    if (knownAoiIds.current) {
      const created = items.find((item) => !knownAoiIds.current!.has(item.id));
      if (created) { setAoiId(created.id); knownAoiIds.current = null; return; }
    }
    if (items.length && !items.some((item) => item.id === aoiId)) setAoiId(items[0]!.id);
  }, [aois.data, aoiId]);

  const availableProducts = useMemo(() => (contract.data?.products ?? []).filter((item) => PRODUCT_KEYS.has(item.key)), [contract.data]);
  const defaultProducts = useMemo<FirrisProduct[]>(() => availableProducts.some((item) => item.key === DEFAULT_PRODUCT && item.available_delivery_types.length > 0) ? [DEFAULT_PRODUCT] : [], [availableProducts]);
  const products = chosenProducts ?? defaultProducts;
  const noProduct = products.length === 0;
  const selectedAoi = aois.data?.items.find((item) => item.id === aoiId);
  const target: InclusivePeriod = { start: form.targetStart, lastDay: form.targetLast };
  const baseline: InclusivePeriod = { start: form.baselineStart, lastDay: form.baselineLast };
  const periodProblems = [periodProblem("Target", target, today), periodProblem("Baseline", baseline, today)].filter((item): item is string => Boolean(item));
  // The API requires the baseline to end before the target starts (no overlap); say so before asking it.
  if (!periodProblems.length && baseline.lastDay >= target.start) periodProblems.push("The baseline must end before the target starts; the two windows may not overlap.");
  const apiForm = periodProblems.length ? null : toApiForm(form);

  // One request shape for the availability check and the submission (the server re-runs the checks on submit).
  const buildRequest = (requestProducts: FirrisProduct[]): AnalysisSubmitRequest | null => selectedAoi && apiForm ? ({
    project_id: projectId, aoi_id: selectedAoi.id, operation: "flood_mapping", products: requestProducts,
    parameters: buildGeeSatelliteWorkflowParameters(apiForm),
    gis_metadata: { crs: selectedAoi.crs, bounding_box: getGeometryBoundingBox(selectedAoi.geometry), spatial_resolution: { x: form.scale, y: form.scale, unit: "m" }, acquisition_date: apiForm.targetEnd, producer: "NOVA GeoRisk", engine_version: contract.data?.engine_version ?? null },
  }) : null;
  // No preflight without a product: the API would refuse the request, and the reason is shown here instead.
  const preflightRequest = firris && project.data?.engine_key === firris.key && !noProduct ? buildRequest(products) : null;
  const preflight = useQuery({
    queryKey: ["analysis-preflight", projectId, selectedAoi?.id, apiForm?.targetStart, apiForm?.targetEnd, apiForm?.baselineStart, apiForm?.baselineEnd, form.maxCloudPct, form.scale],
    queryFn: () => preflightAnalysis(preflightRequest!),
    enabled: preflightRequest !== null,
    staleTime: 60_000,
    retry: false,
  });
  const blocked = (preflight.data?.blocking?.length ?? 0) > 0;
  const opticalWarnings = (preflight.data?.warnings ?? []).filter((issue) => issue.code === "no_compliant_sentinel2" || issue.code === "sentinel2_partial_coverage");
  const opticalReason = opticalWarnings.some((issue) => issue.code === "no_compliant_sentinel2") ? "no compliant Sentinel-2 scene" : "Sentinel-2 does not cover the whole area";
  // Backlog §4.7 item 5: name the window(s) concerned.
  const opticalWindows = [...new Set(opticalWarnings.map((issue) => issue.period).filter((period): period is "target" | "baseline" => Boolean(period)))].sort().reverse();
  const opticalWhere = opticalWindows.length === 2 ? "both windows" : opticalWindows.length === 1 ? `the ${opticalWindows[0]} window` : "this analysis";
  // "Use nearest pass" extends the window (API terms, end exclusive); the form keeps the inclusive last day.
  const useNearestPass = (period: "target" | "baseline", start: string, end: string) => {
    if (period === "target") setForm((current) => ({ ...current, targetStart: start, targetLast: toLastDay(end) }));
    else setForm((current) => ({ ...current, baselineStart: start, baselineLast: toLastDay(end) }));
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!selectedAoi || !project.data || !firris) throw new Error("Project, engine and AOI are required.");
      if (project.data.engine_key !== firris.key) throw new Error("This project is not configured for the entitled FRRIS engine.");
      return submitAnalysis(buildRequest(products)!);
    },
    onSuccess: (response) => navigate(`/tasks/${response.task.task_id}`),
    onError: (caught) => setProblems([describeApiError(caught)]),
  });

  function run() {
    const found: string[] = [];
    if (!selectedAoi) found.push("Select an area of interest.");
    found.push(...periodProblems);
    if (!Number.isFinite(form.maxCloudPct) || form.maxCloudPct < 0 || form.maxCloudPct > 100) found.push("Cloud cover must be between 0 and 100 percent.");
    if (!Number.isInteger(form.sampleSize) || form.sampleSize < 10 || form.sampleSize > 1000000 || !Number.isFinite(form.trainFraction) || form.trainFraction < .5 || form.trainFraction > .99) found.push("Enter a whole sample size between 10 and 1,000,000 and a training fraction between 0.5 and 0.99.");
    if (!Number.isFinite(form.scale) || form.scale < 1 || form.scale > 1000) found.push("Output scale must be between 1 and 1,000 metres.");
    if (noProduct) found.push(NO_PRODUCT_MESSAGE);
    setProblems(found);
    if (found.length === 0 && !blocked && !noProduct) submit.mutate();
  }

  if ((!routeProjectId && projects.isPending) || (projectId && (project.isPending || aois.isPending)) || engines.isPending) return <LoadingState label="Preparing the FRRIS analysis builder…" />;
  if (projects.isError) return <ErrorState title="Projects could not be loaded" error={projects.error} />;
  if (project.isError) return <ErrorState title="Project could not be loaded" error={project.error} />;
  if (aois.isError) return <ErrorState title="Areas of interest could not be loaded" error={aois.error} />;
  if (engines.isError) return <ErrorState title="Engine access could not be loaded" error={engines.error} />;
  if (!firris) return <ErrorState title="FRRIS is unavailable" error={new Error("This organization does not have an active FRRIS entitlement.")} />;

  const Heading = embedded ? "h2" : "h1";
  const capacity = preflight.data?.capacity;
  const orbits = preflight.data?.shared_relative_orbits ?? [];
  const productLabels = products.map((key) => availableProducts.find((product) => product.key === key)?.label ?? key);
  const id = (name: string) => `${idBase}-${name}`;
  const dateInput = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="fr-field"><span>{label}</span><input type="date" min={SENTINEL1_START} max={today} value={value} onChange={(event) => onChange(event.target.value)} /></label>
  );

  return <div className="fr-builder">
    <header className="fr-page-header fr-builder__header">
      <div className="fr-page-header__text">
        {embedded ? null : <Link className="fr-back" to={FRRIS_ROUTES.analyses}>← Analyses</Link>}
        <Heading>New flood analysis</Heading>
        <p>Define the area and the two periods. FRRIS compares a dry-season baseline with the target period using Sentinel-1 radar.</p>
      </div>
    </header>

    <div className="fr-builder__layout">
      <div className="fr-builder__steps">
        <Step number={1} title="Area of interest" id={id("area")}>
          {routeProjectId ? null : (
            <label className="fr-field"><span>Project</span>
              <select value={projectId} onChange={(event) => { setChosenProjectId(event.target.value); setAoiId(""); }}>
                {frrisProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          {!projectId ? <div className="fr-box fr-box--info" role="status">No FRRIS project yet. <Link to="/projects/new">Create the first FRRIS project</Link></div> : <>
            <fieldset className="fr-choice-list">
              <legend>Area</legend>
              {aois.data?.items.map((aoi) => (
                <label key={aoi.id} className={`fr-choice${aoiId === aoi.id ? " is-selected" : ""}`}>
                  <input type="radio" name={id("aoi")} checked={aoiId === aoi.id} onChange={() => setAoiId(aoi.id)} />
                  <span><strong>{aoi.name}</strong><small><span className="fr-num">{aoi.stats.area_km2.toFixed(1)}</span> km² · {aoi.geometry.type} · {aoi.crs}</small></span>
                </label>
              ))}
              {aois.data?.items.length === 0 ? <p className="fr-help">This project has no areas yet.</p> : null}
            </fieldset>
            <div className="fr-step__actions">
              <button type="button" className="fr-button fr-button--secondary" onClick={() => { knownAoiIds.current = new Set(aois.data?.items.map((item) => item.id)); setWizardOpen(true); }}>Draw or upload an area</button>
              <span className="fr-help">Polygon, rectangle, GeoJSON, KML, Shapefile (.zip) or GeoPackage.</span>
            </div>
          </>}
        </Step>

        <Step number={2} title="Periods and satellite availability" id={id("periods")}>
          <div className="fr-periods">
            <fieldset><legend>Target (flood event)</legend>{dateInput("First day", form.targetStart, (value) => configure("targetStart", value))}{dateInput("Last day (included)", form.targetLast, (value) => configure("targetLast", value))}</fieldset>
            <fieldset><legend>Baseline (dry season)</legend>{dateInput("First day", form.baselineStart, (value) => configure("baselineStart", value))}{dateInput("Last day (included)", form.baselineLast, (value) => configure("baselineLast", value))}</fieldset>
          </div>
          <p className="fr-help">Sentinel-1 data starts on 3 Oct 2014 and passes over the same area about every 12 days. Choose a target period that includes a pass during the flood. End dates are inclusive; the last day can be today ({today}, UTC) at the latest.</p>
          {periodProblems.length && selectedAoi ? <p className="fr-box fr-box--info" role="status">{periodProblems.join(" ")}</p> : null}
          <div aria-live="polite">
            {noProduct && selectedAoi && !periodProblems.length ? <p className="fr-box fr-box--warning" role="status" aria-label="Satellite availability">{NO_PRODUCT_MESSAGE} The availability check runs once a product is selected.</p> : null}
            <PreflightPanel result={noProduct ? undefined : preflight.data} isFetching={!noProduct && preflight.isFetching} error={!noProduct && preflight.error ? describeApiError(preflight.error) : null} onUseNearestPass={useNearestPass} />
          </div>
        </Step>

        <Step number={3} title="Data quality" id={id("quality")}>
          <div className="fr-grid-3">
            <label className="fr-field"><span>Max. cloud cover (Sentinel-2)</span><span className="fr-input-unit"><input type="number" min="0" max="100" value={form.maxCloudPct} onChange={(event) => configure("maxCloudPct", Number(event.target.value))} /><span aria-hidden="true">%</span></span></label>
            <div className="fr-field fr-field--fixed"><span>Min. area coverage</span><strong className="fr-num">{FIXED_RUN_SETTINGS.minimumValidCoveragePct}%</strong><small>fixed</small></div>
            <div className="fr-field fr-field--fixed"><span>Degraded MSI pixels</span><strong className="fr-num">≤ 0.1%</strong><small>fixed</small></div>
          </div>
          <div className="fr-features">
            <span className="fr-features__label">Model features</span>
            <ul>{FIXED_RUN_SETTINGS.features.map((feature) => <li key={feature}>{FEATURE_LABELS[feature] ?? feature}</li>)}</ul>
            <p className="fr-help">Sentinel-2 is used only as the independent accuracy reference, not as a model input.</p>
          </div>
        </Step>

        <Step number={4} title="Products" id={id("products")}>
          <fieldset className="fr-choice-list fr-choice-list--grid">
            <legend>Products to deliver</legend>
            {availableProducts.map((product) => {
              const ready = product.available_delivery_types.length > 0 && SATELLITE_PRODUCTS.has(product.key);
              const checked = products.includes(product.key as FirrisProduct);
              // Products whose module is not approved are listed without a control until they can be delivered.
              if (!ready) return <div key={product.key} className="fr-choice is-disabled"><span><strong>{product.label}</strong><small>Coming soon</small></span></div>;
              return <label key={product.key} className={`fr-choice${checked ? " is-selected" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => setProducts(checked ? products.filter((key) => key !== product.key) : [...products, product.key as FirrisProduct])} />
                <span><strong>{product.label}</strong><small>{product.available_delivery_types.join(" · ")}</small></span>
              </label>;
            })}
          </fieldset>
        </Step>

        <Step number={5} title="Processing and sampling" id={id("processing")}>
          <div className="fr-grid-3 fr-grid-3--wide">
            <label className="fr-field"><span>Sampling method</span><select value={form.samplingStrategy} onChange={(event) => configure("samplingStrategy", event.target.value as BuilderForm["samplingStrategy"])}><option value="stratified_random">Stratified random (recommended)</option><option value="simple_random">Simple random</option></select></label>
            <label className="fr-field"><span>Sample size</span><input type="number" min="10" max="1000000" value={form.sampleSize} onChange={(event) => configure("sampleSize", Number(event.target.value))} /></label>
            <label className="fr-field"><span>Training fraction</span><input type="number" min=".5" max=".99" step=".05" value={form.trainFraction} onChange={(event) => configure("trainFraction", Number(event.target.value))} /></label>
            <label className="fr-field"><span>Output scale</span><span className="fr-input-unit"><input type="number" min="1" max="1000" value={form.scale} onChange={(event) => configure("scale", Number(event.target.value))} /><span aria-hidden="true">m</span></span></label>
          </div>
          <p className="fr-help">The remaining {(100 - form.trainFraction * 100).toFixed(0)}% is reserved for validation. The worker rejects simple-random samples that fail the minimum of {FIXED_RUN_SETTINGS.minPerClass} per class. Random Forest, {FIXED_RUN_SETTINGS.nEstimators} trees, random seed {FIXED_RUN_SETTINGS.randomSeed}.</p>
          <Disclosure title="Preprocessing">
            <div className="fr-toggles">
              {([["Cloud and quality mask", "cloudMask"], ["SAR speckle filtering", "sarSpeckleFilter"], ["Projection normalization", "normalizeProjection"]] as const).map(([label, key]) => (
                <label key={key}><span><strong>{label}</strong><small>Applied server-side and recorded in provenance.</small></span><input type="checkbox" role="switch" checked={form[key]} onChange={(event) => configure(key, event.target.checked)} /></label>
              ))}
            </div>
            <p className="fr-help">AOI clipping is always enforced by the engine and cannot be disabled.</p>
          </Disclosure>
        </Step>
      </div>

      <aside className="fr-summary" aria-labelledby={id("summary")}>
        <section className="fr-card fr-summary__card">
          <h2 id={id("summary")}>Run summary</h2>
          <dl>
            <div><dt>Project</dt><dd>{project.data?.name ?? "Not selected"}</dd></div>
            <div><dt>Area</dt><dd>{selectedAoi ? <>{selectedAoi.name} · <span className="fr-num">{selectedAoi.stats.area_km2.toFixed(1)}</span> km²</> : "Not selected"}</dd></div>
            <div><dt>Baseline</dt><dd>{formatPeriod(baseline)}</dd></div>
            <div><dt>Target</dt><dd>{formatPeriod(target)}</dd></div>
            <div><dt>Radar</dt><dd>Sentinel-1 VV{orbits.length ? ` · orbit ${orbits.join(", ")}` : ""}</dd></div>
            <div><dt>Reference</dt><dd>Sentinel-2 (independent accuracy)</dd></div>
            <div><dt>Quality</dt><dd>Cloud ≤ {form.maxCloudPct}% · cover ≥ {FIXED_RUN_SETTINGS.minimumValidCoveragePct}% · MSI ≤ 0.1%</dd></div>
            <div><dt>Products</dt><dd>{productLabels.length ? productLabels.join(", ") : "None selected"}</dd></div>
            <div><dt>Sampling</dt><dd>{form.samplingStrategy.replaceAll("_", " ")} · {form.sampleSize.toLocaleString("en-GB")} · {(form.trainFraction * 100).toFixed(0)}% training</dd></div>
            <div><dt>Resolution</dt><dd>{form.scale} m</dd></div>
          </dl>
          {capacity ? (
            <div className="fr-meter">
              <div className="fr-meter__label"><span>Download size estimate</span><span className="fr-num">{downloadSizeText(capacity)}</span></div>
              <div className="fr-meter__track" role="img" aria-label={`Download size estimate: ${downloadSizeText(capacity)} limit`}>
                <div className={`fr-meter__bar${capacity.estimated_request_bytes > capacity.limit_bytes ? " is-over" : ""}`} style={{ width: `${Math.min(100, (capacity.estimated_request_bytes / capacity.limit_bytes) * 100)}%` }} />
              </div>
              <span className="fr-help">{(capacity.limit_bytes / MIB).toFixed(0)} MiB is the provider's limit per request at {capacity.scale_m} m.</span>
            </div>
          ) : null}
          {problems.length ? <div className="fr-box fr-box--danger" role="alert"><ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul></div> : null}
          <button type="button" className="fr-button fr-button--primary fr-summary__run" disabled={blocked || noProduct || submit.isPending} onClick={run}>{submit.isPending ? "Submitting…" : "Run analysis"}</button>
          {noProduct ? <span className="fr-summary__hint" role="status" aria-label="Before you run">{NO_PRODUCT_MESSAGE}</span> : null}
          {blocked ? <span className="fr-summary__hint" role="status">Resolve the blocked dates above to continue.</span> : null}
          {!blocked && opticalWarnings.length ? <span className="fr-summary__hint fr-summary__hint--warning" role="status" aria-label="Before you continue">Independent accuracy not assessable for {opticalWhere} (see the warning above).</span> : null}
          <Link className="fr-button fr-button--secondary" to={embedded ? `/projects/${projectId}` : FRRIS_ROUTES.analyses}>Cancel</Link>
        </section>
        <p className="fr-summary__tip"><strong>Tip</strong> Choose a baseline from the dry season close to the event. Large areas may need to be split to stay under the download limit.</p>
      </aside>
    </div>
    {wizardOpen && projectId ? <AoiWizard projectId={projectId} projectName={project.data?.name} onClose={() => setWizardOpen(false)} /> : null}
  </div>;
}
