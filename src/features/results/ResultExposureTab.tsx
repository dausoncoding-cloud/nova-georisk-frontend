// Depth & Exposure module, Phase 2 (plan item 2.6): estimated people and buildings inside each extent.
// Read-only from summary.flood_exposure; maps are the report's own package files. Estimates, never "people affected".
import type { components } from "../../shared/api/generated/nova-browser-api";
import type { ResultArtifact } from "./gisViewer";
import { protectedProductUrl } from "./resultsApi";
import { asRecord } from "./resultView";
import { ResultAdminExposure } from "./ResultAdminExposure";

type Result = components["schemas"]["ResultResponse"];
type Row = Record<string, unknown>;

const int = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value).toLocaleString("en-GB") : "—");
const km2 = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");

export function exposureRecord(data: Result): Row | null {
  return asRecord(asRecord(data.summary)?.flood_exposure) ?? null;
}

function buildingsText(value: unknown) {
  const b = asRecord(value) ?? {};
  if (b.status !== "counted") return `not available: ${String(b.reason ?? "")}`;
  return `${int(asRecord(b["0.75"])?.count)} (${int(asRecord(b["0.65"])?.count)})`;
}

export function ResultExposureTab({ data, artifacts }: { data: Result; artifacts: readonly ResultArtifact[] }) {
  const record = exposureRecord(data);
  if (!record) return null;
  if (record.status !== "assessed") {
    return <section className="fr-box fr-box--warning" role="status" aria-label="Estimated exposure"><span><strong>Estimated exposure: not available.</strong> {String(record.reason ?? "")}</span></section>;
  }
  const population = asRecord(record.population) ?? {};
  const buildings = asRecord(record.buildings) ?? {};
  const year = String(population.year ?? "");
  const yearStatus = asRecord(population.year_status) ?? {};
  const rows = (Array.isArray(record.rows) ? record.rows : []).map((row) => asRecord(row) ?? {});
  const observed = rows.find((row) => row.extent === "observed_extent");
  const masked = asRecord(observed?.sensitivity_glofas_permanent_water_masked);
  // The observed extent inherits the flood map's commission error (owner, 2026-11-17).
  const caveat = asRecord(record.observed_extent_caveat);
  const cluster = asRecord(record.observed_cluster);
  const byKey = new Map(artifacts.map((item) => [item.key, item]));
  const maps = [["exposed_population_observed_extent_map_png", "the observed flood candidates of this run"], ["exposed_population_rp100_map_png", "the modelled 1-in-100-year zone"]] as const;
  return <div className="fr-tab-stack">
    <section className="fr-card fr-section" aria-label="Estimated exposure">
      <div className="fr-section__head"><h3>Estimated exposure</h3><span className="fr-pill fr-pill--neutral">Estimates — not people affected</span></div>
      <p>{String(record.wording ?? "")}</p>
      <p><strong>People:</strong> WorldPop R2025A, {year} — {String(yearStatus.text ?? "")}. Area-weighted: the people of each 100 m cell × the share of the cell inside the extent. {String(population.release_caveat ?? "")}</p>
      <p><strong>Buildings:</strong> Google Open Buildings {String(buildings.version ?? "")}, centroid inside the extent, confidence ≥ {Number(buildings.primary_threshold ?? 0.75).toFixed(2)} (≥ {Number(buildings.sensitivity_threshold ?? 0.65).toFixed(2)} in brackets). {String(buildings.threshold_note ?? "")} Exact counts, no sampling. {String(buildings.limitation ?? "")} {buildings.spot_check ? `Spot-check: ${String(buildings.spot_check)}.` : ""}</p>
      <p className="fr-help">{String(record.permanent_water ?? "")}</p>
      <div className="fr-table-wrap">
        <table className="fr-table">
          <caption>Estimated exposure by extent (WorldPop {year}, {String(yearStatus.status ?? "")}; Open Buildings centroid count)</caption>
          <thead><tr><th scope="col">Extent</th><th scope="col">Area (km²)</th><th scope="col">People (estimate)</th><th scope="col">Buildings ≥ 0.75 (≥ 0.65)</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={String(row.extent)}>
            <th scope="row">{String(row.label ?? row.extent)}</th><td className="fr-num">{km2(row.area_km2)}</td>
            <td className="fr-num">{int(row.people)}</td><td className="fr-num">{buildingsText(row.buildings)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {observed && caveat ? <p className="fr-box fr-box--warning" aria-label="Observed extent caveat"><span><strong>Observed flood candidates:</strong> {String(caveat.text ?? "")} {String(caveat.built_up_note ?? "")}{cluster?.text ? ` ${String(cluster.text)}` : ""}</span></p> : null}
      {observed ? <p className="fr-help">{masked ? `Sensitivity only: masking the observed flood candidates with the coarser GloFAS permanent water would give ${km2(masked.area_km2)} km² and ${int(masked.people)} people. ` : ""}Counting every 100 m cell that touches the observed extent would give {int(observed.people_cells_touching)} people; that overstates exposure and is not used.</p> : null}
    </section>
    {record.by_admin_unit ? <ResultAdminExposure record={record} resultId={data.id} artifacts={artifacts} /> : null}
    <section className="fr-figures" aria-label="Exposure maps">
      {maps.map(([key, what]) => {
        const artifact = byKey.get(key);
        const extra = key.includes("observed") && caveat?.text ? ` ${String(caveat.text)}` : "";
        return artifact ? <figure key={key} className="fr-figure"><img src={protectedProductUrl(data.id, artifact.key)} alt={artifact.label} loading="lazy" /><figcaption>Estimated people per ~100 m cell inside {what} (WorldPop {year}, area-weighted).{extra}</figcaption></figure> : null;
      })}
    </section>
    <section className="fr-card fr-section" aria-label="Exposure sources">
      <h3>Sources and licences</h3>
      <p>{String(population.citation ?? "")}. Licence: {String(population.licence ?? "")}.</p>
      <p>{String(buildings.citation ?? "")}. Licence: {String(buildings.licence ?? "")}.</p>
      {record.glofas_zone_notice ? <p>{String(record.glofas_zone_notice)}</p> : null}
    </section>
  </div>;
}
