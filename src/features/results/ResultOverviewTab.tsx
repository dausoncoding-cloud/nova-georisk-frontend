import { useState, type ReactNode } from "react";
import type { components } from "../../shared/api/generated/nova-browser-api";
import type { ResultArtifact } from "./gisViewer";
import { ResultOverview } from "./ResultOverview";
import { protectedProductUrl } from "./resultsApi";
import { asRecord, fixed, framedMaps, independentScope, INDEPENDENT_STATUS_TEXT } from "./resultView";

type Result = components["schemas"]["ResultResponse"];

const MAP_SWITCH_LABELS: Record<string, string> = { flood_extent: "Extent", flood_probability: "Confidence score" };
const coordinate = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;

function mapAlt(data: Result, map: ResultArtifact, productLabel: string, aoiName: string | null) {
  const layer = data.layers.find((item) => item.product_key === map.product_key && item.bounding_box);
  const box = asRecord(layer?.bounding_box);
  const bounds = box && ["west", "east", "south", "north"].every((key) => typeof box[key] === "number")
    ? `, ${coordinate(box.west as number, "E", "W")}–${coordinate(box.east as number, "E", "W")}, ${coordinate(box.north as number, "N", "S")}–${coordinate(box.south as number, "N", "S")}`
    : "";
  return `Framed map of the ${productLabel.toLowerCase()}${aoiName ? `, ${aoiName}` : ""}${bounds}`;
}

export function ResultOverviewTab({ data, artifacts, aoiName, viewer, onOpenTab }: {
  data: Result; artifacts: readonly ResultArtifact[]; aoiName: string | null; viewer: ReactNode; onOpenTab: (tab: string) => void;
}) {
  const maps = framedMaps(artifacts);
  const [mapKey, setMapKey] = useState(maps[0]?.key ?? "");
  const map = maps.find((item) => item.key === mapKey) ?? maps[0] ?? null;
  const headline = data.overview?.headline ?? null;
  const independent = independentScope(data.validation_dashboard);
  const assessment = data.validation_dashboard?.accuracy_assessment ?? null;
  const status = assessment?.independent_status ?? data.validation_dashboard?.independent_validation ?? "not_performed";
  const productLabel = (key: string | null | undefined) => data.products.find((item) => item.key === key)?.label ?? key?.replaceAll("_", " ") ?? "Map";
  const summary = asRecord(data.summary);
  const quality = asRecord(summary?.quality);
  const firstLayer = data.layers.find((layer) => layer.renderable);
  const limitations = Array.from(new Set([...(data.analytics?.limitations ?? []), ...(data.validation_dashboard?.limitations ?? [])]));

  return <div className="fr-tab-stack">
    <h2 className="fr-visually-hidden">Overview</h2>
    {headline ? (
      <section className="fr-metrics" aria-label="Key figures">
        {headline.flood_candidate_area_km2 !== null ? <div className="fr-metric fr-metric--wide">
          <span>Flood-candidate area</span>
          <strong className="fr-num">{fixed(headline.flood_candidate_area_km2, 2)} km²</strong>
          {headline.percent_of_valid !== null && headline.valid_area_km2 !== null ? <small>{fixed(headline.percent_of_valid, 2)}% of {fixed(headline.valid_area_km2, 2)} km² analysed</small> : null}
        </div> : null}
        {independent ? <>
          <div className="fr-metric"><span>Overall accuracy</span><strong className="fr-num">{fixed(independent.overall_accuracy_pct, 1) ?? "—"}%</strong><small>Independent Sentinel-2 reference</small></div>
          <div className="fr-metric"><span>Kappa</span><strong className="fr-num">{fixed(independent.cohens_kappa, 3) ?? "—"}</strong></div>
          <div className="fr-metric"><span>F1 (flood class)</span><strong className="fr-num">{fixed(independent.f1_flooded, 3) ?? "—"}</strong></div>
        </> : (
          <div className="fr-metric fr-metric--status">
            <span>Independent accuracy</span>
            <strong>{(INDEPENDENT_STATUS_TEXT[status] ?? status).replace(/^./, (letter) => letter.toUpperCase())}</strong>
            {assessment?.independent_reason ? <small>{assessment.independent_reason}</small> : null}
          </div>
        )}
      </section>
    ) : null}

    {map ? (
      <section className="fr-card fr-section fr-map" aria-labelledby="overview-map-title">
        <div className="fr-section__head">
          <h3 id="overview-map-title">{productLabel(map.product_key)}</h3>
          {maps.length > 1 ? <div role="group" aria-label="Map layer" className="fr-segmented">
            {maps.map((item) => <button key={item.key} type="button" aria-pressed={item.key === map.key} onClick={() => setMapKey(item.key)}>{MAP_SWITCH_LABELS[item.product_key ?? ""] ?? productLabel(item.product_key)}</button>)}
          </div> : null}
        </div>
        <img className="fr-map__image" src={protectedProductUrl(data.id, map.key)} alt={mapAlt(data, map, productLabel(map.product_key), aoiName)} />
        <p className="fr-help">Framed map from the result package. It shows the map only: add the title, north arrow and scale bar in GIS from the downloaded layers.</p>
      </section>
    ) : viewer}

    {headline ? (
      <section className="fr-card fr-section" aria-labelledby="overview-summary">
        <h3 id="overview-summary">Summary</h3>
        <p>{headline.text}</p>
        <button type="button" className="fr-link-button" onClick={() => onOpenTab("accuracy")}>See the full accuracy assessment →</button>
      </section>
    ) : null}

    {quality?.status === "failed" ? <div className="fr-box fr-box--danger" role="alert">The scientific quality gate failed. Review the delivered checks in the accuracy assessment before using this result.</div> : null}
    {data.overview ? <div className="fr-card fr-section fr-overview-details"><ResultOverview overview={data.overview} showHeadline={false} /></div> : null}
    <dl className="fr-facts fr-card fr-section" aria-label="Delivered output summary">
      <div><dt>Outputs</dt><dd>{artifacts.length} file{artifacts.length === 1 ? "" : "s"} · {data.layers.length} map layer{data.layers.length === 1 ? "" : "s"}</dd></div>
      <div><dt>CRS</dt><dd>{firstLayer?.crs ?? "Not supplied"}</dd></div>
      <div><dt>Independent validation</dt><dd>{status === "assessed" ? "Assessed against an independent reference" : (INDEPENDENT_STATUS_TEXT[status] ?? status).replace(/^./, (letter) => letter.toUpperCase())}</dd></div>
    </dl>
    {limitations.length && !data.overview ? <div className="fr-box fr-box--info" role="note"><div><strong>Limitations</strong><ul>{limitations.slice(0, 3).map((text) => <li key={text}>{text}</li>)}</ul></div></div> : null}
  </div>;
}
