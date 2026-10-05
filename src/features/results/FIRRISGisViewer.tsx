import { useEffect, useMemo, useState } from "react";
import { GeoJSON, ImageOverlay, MapContainer, ScaleControl, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { components } from "../../shared/api/generated/nova-browser-api";
import type { GeoJsonGeometry } from "../aois/geometry";
import { protectedProductUrl } from "./resultsApi";
import {
  artifactsForLayer,
  defaultLegend,
  loadProtectedRaster,
  loadProtectedVector,
  selectRasterArtifact,
  selectVectorArtifact,
  type Bounds,
  type GeoJsonFeatureCollection,
  type RasterData,
  type ResultArtifact,
  type ResultLayer,
} from "./gisViewer";

type AOI = { geometry: GeoJsonGeometry; crs: string; name: string };

function normalizedBounds(value: Record<string, number> | null | undefined): Bounds | null {
  if (!value) return null;
  const west = value.west;
  const south = value.south;
  const east = value.east;
  const north = value.north;
  return typeof west === "number" && typeof south === "number" && typeof east === "number" && typeof north === "number" && [west, south, east, north].every(Number.isFinite)
    ? { west, south, east, north } : null;
}

function LayerLegendView({ layer, raster }: { layer: ResultLayer; raster: RasterData | null }) {
  const fallback = defaultLegend(layer.product_key, raster?.minimum, raster?.maximum);
  const metadata = layer.legend && !Array.isArray(layer.legend) && typeof layer.legend === "object" ? layer.legend as Record<string, unknown> : null;
  const entries = Array.isArray(metadata?.entries) && metadata.entries.every((item) => item && typeof item === "object" && typeof item.label === "string" && typeof item.color === "string")
    ? metadata.entries as Array<{ label: string; color: string }> : fallback.entries;
  const title = typeof metadata?.title === "string" ? metadata.title : "Legend";
  return <div className="gis-legend" aria-label={`${layer.label} legend`}><strong>{title}</strong><div className="legend-entries">{entries.map((entry, index) => <span key={`${entry.color}-${index}`}><i style={{ background: entry.color }} />{entry.label || " "}</span>)}</div>{fallback.minimum !== undefined && fallback.maximum !== undefined ? <small>Displayed range: {fallback.minimum.toFixed(2)} – {fallback.maximum.toFixed(2)} {layer.units ?? ""}</small> : null}</div>;
}

function leafletBounds(bounds: Bounds, crs: string | null | undefined): LatLngBoundsExpression | null {
  if (!crs || crs.toUpperCase().includes("4326")) return [[bounds.south, bounds.west], [bounds.north, bounds.east]];
  if (crs.toUpperCase().includes("3857")) {
    const inverse = (x: number, y: number): [number, number] => [Math.atan(Math.sinh(y / 6378137)) * 180 / Math.PI, x / 6378137 * 180 / Math.PI];
    return [inverse(bounds.west, bounds.south), inverse(bounds.east, bounds.north)];
  }
  return null;
}

function MapFitter({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => { map.fitBounds(bounds, { padding: [20, 20] }); }, [bounds, map]);
  return null;
}

function MapCoordinates() {
  const [coordinates, setCoordinates] = useState("Move over map");
  useMapEvents({ mousemove(event) { setCoordinates(`${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`); } });
  return <div className="map-coordinates" aria-live="off">{coordinates}</div>;
}

function rasterUrl(raster: RasterData): string {
  const canvas = document.createElement("canvas");
  canvas.width = raster.width; canvas.height = raster.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
  context.putImageData(new ImageData(new Uint8ClampedArray(raster.rgba), raster.width, raster.height), 0, 0);
  return canvas.toDataURL("image/png");
}

function GisLayerPane({ resultId, layer, artifacts, aoi, showAoi }: { resultId: string; layer: ResultLayer; artifacts: ResultArtifact[]; aoi: AOI | null; showAoi: boolean }) {
  const [raster, setRaster] = useState<RasterData | null>(null);
  const [vector, setVector] = useState<GeoJsonFeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [opacity, setOpacity] = useState(0.82);
  const [basemap, setBasemap] = useState<"light" | "street" | "none">("light");
  const rasterArtifact = useMemo(() => selectRasterArtifact(layer, artifacts), [layer, artifacts]);
  const vectorArtifact = useMemo(() => selectVectorArtifact(layer, artifacts), [layer, artifacts]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRaster(null);
    setVector(null);
    const operation = layer.layer_type === "vector" && vectorArtifact
      ? loadProtectedVector(protectedProductUrl(resultId, vectorArtifact.key), controller.signal).then(setVector)
      : rasterArtifact && rasterArtifact.artifact_type !== "preview"
        ? loadProtectedRaster(protectedProductUrl(resultId, rasterArtifact.key), layer.product_key, controller.signal).then(setRaster)
        : Promise.resolve();
    operation.catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The GIS layer could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attempt, layer.layer_type, layer.product_key, rasterArtifact, resultId, vectorArtifact]);

  const bounds = raster?.bounds ?? normalizedBounds(layer.bounding_box);
  const targetCrs = raster?.crs ?? layer.crs;
  let projectionError: string | null = null;
  const mapBounds = bounds ? leafletBounds(bounds, targetCrs) : null;
  if (bounds && !mapBounds) projectionError = `Interactive display does not support ${targetCrs ?? "the declared CRS"}; download the GIS artifact for authoritative use.`;
  let imageUrl: string | null = null;
  try { imageUrl = raster ? rasterUrl(raster) : null; } catch (reason) { projectionError = reason instanceof Error ? reason.message : "Raster preview could not be prepared."; }

  const preview = rasterArtifact?.artifact_type === "preview" ? rasterArtifact : undefined;
  return <article className="gis-pane">
    <header><div><span className="engine-key">{layer.layer_type} · {targetCrs ?? "CRS unavailable"}</span><h3>{layer.label}</h3></div><span className={`layer-state ${layer.renderable ? "layer-state--ready" : ""}`}>{layer.renderable ? "Ready" : "Metadata"}</span></header>
    <div className="gis-pane-toolbar"><label>Basemap<select value={basemap} onChange={(event) => setBasemap(event.target.value as typeof basemap)}><option value="light">Light</option><option value="street">Street</option><option value="none">None</option></select></label><label>Opacity<input aria-label={`${layer.label} opacity`} type="range" min="0" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label><button type="button" className="button button--quiet button--small" onClick={() => setAttempt((value) => value + 1)}>Refresh layer</button></div>
    <div className="gis-map-frame gis-map-frame--interactive">
      {loading ? <div className="gis-map-state"><span className="spinner" /><strong>Loading protected layer…</strong></div> : null}
      {error ? <div className="gis-map-state gis-map-state--error"><strong>Layer unavailable</strong><p>{error}</p><button className="button button--quiet" type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : null}
      {!loading && !error && mapBounds ? <MapContainer bounds={mapBounds} zoomControl className="leaflet-fill"><MapFitter bounds={mapBounds} />{basemap === "light" ? <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" /> : null}{basemap === "street" ? <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /> : null}{imageUrl ? <ImageOverlay url={imageUrl} bounds={mapBounds} opacity={opacity} /> : null}{preview && !imageUrl ? <ImageOverlay url={protectedProductUrl(resultId, preview.key)} bounds={mapBounds} opacity={opacity} /> : null}{vector ? <GeoJSON data={vector as GeoJSON.FeatureCollection} style={{ color: "#007d8e", fillColor: "#2ec2cf", fillOpacity: opacity * .55, weight: 2 }} /> : null}{showAoi && aoi && aoi.crs.toUpperCase().includes("4326") ? <GeoJSON data={aoi.geometry as GeoJSON.Geometry} style={{ color: "#ffffff", dashArray: "7 5", fillOpacity: 0, weight: 3 }} /> : null}<ScaleControl imperial={false} /><MapCoordinates /><div className="map-north" aria-label="North">N<span>↑</span></div><div className="map-crs">{targetCrs}</div></MapContainer> : null}
      {!loading && !error && !raster && !vector && !preview ? <div className="gis-map-state"><strong>No renderable artifact</strong><p>{layer.rendering_reason ?? "Download the available product for desktop GIS."}</p></div> : null}
    </div>
    {projectionError ? <div className="inline-alert" role="alert">{projectionError}</div> : null}
    {raster?.crs && layer.crs && raster.crs.toUpperCase() !== layer.crs.toUpperCase() ? <div className="inline-alert" role="alert">Raster CRS {raster.crs} differs from contract CRS {layer.crs}.</div> : null}
    <LayerLegendView layer={layer} raster={raster} />
    <dl className="gis-pane-facts"><div><dt>Bounds</dt><dd>{bounds ? `${bounds.west.toFixed(4)}, ${bounds.south.toFixed(4)} → ${bounds.east.toFixed(4)}, ${bounds.north.toFixed(4)}` : "Unavailable"}</dd></div><div><dt>Resolution</dt><dd>{layer.spatial_resolution ? `${String(layer.spatial_resolution.x)} × ${String(layer.spatial_resolution.y)} ${String(layer.spatial_resolution.unit ?? "")}` : raster ? `${raster.width} × ${raster.height} display cells` : "Unavailable"}</dd></div></dl>
  </article>;
}

export function FIRRISGisViewer({ resultId, layers, artifacts, aoi }: { resultId: string; layers: ResultLayer[]; artifacts: ResultArtifact[]; aoi: AOI | null }) {
  const renderable = layers.filter((layer) => layer.renderable);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => renderable.slice(0, 1).map((layer) => layer.key));
  const [showAoi, setShowAoi] = useState(true);
  const visibleLayers = layers.filter((layer) => visibleKeys.includes(layer.key));

  function toggleLayer(key: string) {
    setVisibleKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : current.length < 2 ? [...current, key] : current);
  }

  return <div className="gis-viewer">
    <aside className="gis-controls">
      <div><span className="eyebrow">Layer visibility</span><h3>Compare products</h3><p>Select up to two result layers.</p></div>
      <label className="visibility-option"><input type="checkbox" checked={showAoi} onChange={(event) => setShowAoi(event.target.checked)} /><span>AOI boundary</span></label>
      {layers.map((layer) => {
        const checked = visibleKeys.includes(layer.key);
        return <label className={`visibility-option${!layer.renderable ? " visibility-option--disabled" : ""}`} key={layer.key}><input type="checkbox" checked={checked} disabled={!layer.renderable || (!checked && visibleKeys.length >= 2)} onChange={() => toggleLayer(layer.key)} /><span>{layer.label}<small>{layer.layer_type} · {layer.crs ?? "Unknown CRS"}</small></span></label>;
      })}
    </aside>
    <div className={`gis-comparison${visibleLayers.length === 2 ? " gis-comparison--split" : ""}`}>
      {visibleLayers.length === 0 ? <div className="empty-state"><h3>Select a renderable layer</h3><p>Metadata-only products remain available in the download center.</p></div> : visibleLayers.map((layer) => <GisLayerPane key={layer.key} resultId={resultId} layer={layer} artifacts={artifactsForLayer(layer, artifacts)} aoi={aoi} showAoi={showAoi} />)}
    </div>
  </div>;
}
