import type { ReactNode } from "react";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { Disclosure } from "../../shared/ui/Disclosure";
import { DeliveredMetadata } from "./QuantitativeDelivery";
import { asRecord, COUNT, inclusiveWindow, modelLabel, scenes, scienceVersionLabel } from "./resultView";

type Result = components["schemas"]["ResultResponse"];

type Row = [string, ReactNode | null | undefined];
function Facts({ title, rows, note }: { title: string; rows: Row[]; note?: string | null }) {
  const shown = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!shown.length) return null;
  const id = `prov-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="fr-card fr-section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <dl className="fr-facts">{shown.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {note ? <p className="fr-help">{note}</p> : null}
    </section>
  );
}

const str = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : null;
const unique = <T,>(values: T[]) => [...new Set(values)];
const datesOf = (list: { acquired_at?: string }[]) => unique(list.map((scene) => scene.acquired_at).filter((day): day is string => Boolean(day))).sort();
const max = (values: (number | undefined)[]) => { const numbers = values.filter((value): value is number => typeof value === "number"); return numbers.length ? Math.max(...numbers) : null; };

export function ResultProvenanceTab({ data }: { data: Result }) {
  const provenance = asRecord(data.provenance) ?? {};
  const summary = asRecord(data.summary);
  const model = asRecord(summary?.model);
  const modelSelection = asRecord(provenance.model_selection);
  const parameters = asRecord(asRecord(modelSelection?.configuration)?.parameters) ?? asRecord(asRecord(model?.configuration)?.parameters);
  const sampling = asRecord(provenance.sampling);
  const classCounts = asRecord(sampling?.class_counts);
  const s1Target = scenes(provenance, "sentinel_1_target");
  const s1Baseline = scenes(provenance, "sentinel_1_baseline");
  const s2Target = scenes(provenance, "sentinel_2_target");
  const s2Baseline = scenes(provenance, "sentinel_2_baseline");
  const chirps = scenes(provenance, "chirps_target");
  const orbits = unique([...s1Target, ...s1Baseline].map((scene) => scene.relative_orbit).filter((orbit) => orbit != null));
  const passes = unique([...s1Target, ...s1Baseline].map((scene) => scene.pass?.toLowerCase()).filter(Boolean));
  const opticalMask = asRecord(provenance.optical_mask);
  const opticalScenes = [...s2Target, ...s2Baseline];
  const staticLineage = asRecord(provenance.static_source_lineage);
  const assetOf = (key: string) => str(asRecord(staticLineage?.[key])?.asset_id);
  const features = Array.isArray(provenance.band_identity) ? (provenance.band_identity as string[]).filter((band) => ["sar_vv_target", "sar_change", "elevation", "slope", "rainfall"].includes(band)) : [];
  const gates = data.overview?.quality_gates ?? [];
  const STATUS: Record<string, string> = { pass: "pass", fail: "fail", not_recorded: "not recorded", not_applicable: "not applicable" };
  const datasets = Array.isArray(provenance.datasets) ? provenance.datasets as string[] : [];
  const has = (dataset: string) => datasets.includes(dataset) ? dataset : null;

  return <div className="fr-tab-stack">
    <h2 className="fr-visually-hidden">Provenance</h2>
    <Facts title="Run" rows={[
      ["Result ID", <code>{data.id}</code>],
      ["Science version", scienceVersionLabel(str(provenance.science_version))],
      ["Workflow", str(provenance.workflow) ? `${str(provenance.workflow)}${str(provenance.workflow_version) ? `, version ${str(provenance.workflow_version)}` : ""}` : null],
      ["Model", modelLabel(str(model?.model_key), str(model?.model_version))],
      ["Engine", str(provenance.engine_version) ? `FRRIS engine ${str(provenance.engine_version)}` : null],
      ["Result created", `${data.created_at.slice(0, 16).replace("T", " ")} UTC`],
      ["Result version", String(data.version)],
      ["Producer", str(provenance.producer)],
      ["Provider", str(provenance.provider)],
    ]} />
    <Facts title="Sentinel-1 radar" rows={[
      ["Collection", has("COPERNICUS/S1_GRD") ? `COPERNICUS/S1_GRD${passes.length ? ` (VV, ${passes.join(" / ")})` : ""}` : null],
      ["Relative orbit", orbits.length ? `${orbits.join(" / ")}${orbits.length === 1 && s1Target.length && s1Baseline.length ? " in both periods" : ""}` : null],
      ["Target window", inclusiveWindow(provenance.target_period)],
      ["Target pass", datesOf(s1Target).join(", ") || null],
      ["Baseline window", inclusiveWindow(provenance.baseline_period)],
      ["Baseline pass", datesOf(s1Baseline).join(", ") || null],
    ]} />
    <Facts title="Sentinel-2 reference" rows={[
      ["Collection", has("COPERNICUS/S2_SR_HARMONIZED")],
      ["Scenes used", opticalScenes.length ? [datesOf(s2Baseline).length ? `${datesOf(s2Baseline).join(", ")} (baseline)` : null, datesOf(s2Target).length ? `${datesOf(s2Target).join(", ")} (target)` : null].filter(Boolean).join(" · ") : null],
      ["Tiles", unique(opticalScenes.map((scene) => scene.tile).filter(Boolean)).join(", ") || null],
      ["Cloud cover", max(opticalScenes.map((scene) => scene.cloud_pct)) === null ? null : `max ${max(opticalScenes.map((scene) => scene.cloud_pct))!.toFixed(1)}%`],
      ["Degraded MSI", max(opticalScenes.map((scene) => scene.degraded_msi_pct)) === null ? null : `max ${max(opticalScenes.map((scene) => scene.degraded_msi_pct))!.toFixed(2)}%`],
      ["Pixel mask", Array.isArray(opticalMask?.excluded_classes) ? `${str(opticalMask?.band) ?? "SCL"} ${(opticalMask!.excluded_classes as number[]).join(", ")}` : null],
    ]} note={str(asRecord(asRecord(provenance.indices)?.mndwi)?.role) ? `Sentinel-2 (MNDWI): ${str(asRecord(asRecord(provenance.indices)?.mndwi)?.role)}.` : null} />
    <Facts title="Labels and model" rows={[
      ["Label source", str(provenance.label_source)],
      ["Screening label", data.validation_dashboard?.reference_basis?.rule ?? null],
      ["Model", parameters ? `${str(modelSelection?.algorithm)?.replaceAll("_", " ") ?? "Random forest"}, ${str(parameters.n_estimators) ?? "—"} trees, seed ${str(parameters.random_state) ?? "—"}` : null],
      ["Features", features.length ? features.join(", ") : null],
      ["Sampling", sampling ? `${COUNT.format(Number(sampling.sample_size_used ?? sampling.sample_size_requested))} samples · ${str(sampling.strategy)?.replaceAll("_", " ")} · train fraction ${str(sampling.train_fraction)}` : null],
      ["Class support", classCounts ? Object.entries(classCounts).map(([label, value]) => `${label === "1" ? "flood candidate" : label === "0" ? "not flooded" : `class ${label}`} ${COUNT.format(Number(value))}`).join(" · ") : null],
      ["Reference rule", str(asRecord(provenance.optical_reference_policy)?.definition)],
    ]} />
    {gates.length ? <Facts title="Quality gates" rows={gates.map((gate) => [gate.name, `${gate.observed ?? "—"} (${gate.threshold}) · ${STATUS[gate.status] ?? gate.status}`])} /> : null}
    <Facts title="Ancillary data" rows={[
      ["Rainfall", has("UCSB-CHG/CHIRPS/DAILY") ? `UCSB-CHG/CHIRPS/DAILY${chirps.length ? ` (${datesOf(chirps).join(", ")})` : ""}` : null],
      ["Elevation · slope", assetOf("dem")],
      ["Permanent water", [assetOf("water_occurrence"), assetOf("water_observation")].filter(Boolean).join(" + ") || null],
      ["JRC mask policy", str(asRecord(provenance.jrc_mask_policy)?.policy)],
    ]} />

    <section className="fr-card fr-section" aria-labelledby="prov-all">
      <h3 id="prov-all">All provenance fields</h3>
      <p className="fr-help">Every field recorded for this result, as delivered by the API. Dates here are API values (end dates exclusive).</p>
      {Object.entries(provenance).map(([key, value]) => (
        value && typeof value === "object"
          ? <Disclosure key={key} title={key.replaceAll("_", " ")}><DeliveredMetadata value={Array.isArray(value) ? { values: value } : value as Record<string, unknown>} /></Disclosure>
          : <dl key={key} className="metadata-list"><div><dt>{key.replaceAll("_", " ")}</dt><dd>{value === null ? "—" : String(value)}</dd></div></dl>
      ))}
      {data.layers.map((layer) => <Disclosure title={`Spatial reference: ${layer.label}`} key={layer.key}><DeliveredMetadata value={{ crs: layer.crs, resolution: layer.spatial_resolution, bounds: layer.bounding_box, acquisition: layer.temporal_metadata, units: layer.units, nodata: layer.nodata }} /></Disclosure>)}
      <Disclosure title="Model configuration"><DeliveredMetadata value={model} /></Disclosure>
      <Disclosure title="Product metadata"><DeliveredMetadata value={asRecord(summary?.products)} /></Disclosure>
      <Disclosure title="Raw result summary"><pre className="fr-pre">{JSON.stringify(data.summary, null, 2)}</pre></Disclosure>
    </section>
  </div>;
}
