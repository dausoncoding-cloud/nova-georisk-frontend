import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { getErrorMessage } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { Icon } from "../../shared/ui/Icon";
import { useToast } from "../../shared/ui/Toast";
import { createAoi, createAoiFromAdministrativeBoundary, inspectGeopackageLayers, searchAdministrativeBoundaries, uploadGeopackageAoi, uploadShapefileAoi } from "./aoisApi";
import { AoiGeometryPreview } from "./AoiGeometryPreview";
import { AoiDrawingMap } from "./AoiDrawingMap";
import { estimateGeometryStats, parseGeoJsonFile, parseKml, parseShapefilePreview } from "./aoiFiles";
import { getGeometryBoundingBox, type GeoJsonGeometry } from "./geometry";

type SourceType = components["schemas"]["AOISourceType"];
type Method = "draw" | "rectangle" | "geojson" | "shapefile" | "kml" | "gpkg" | "admin";

const methods: Array<{ key: Method; title: string; description: string; enabled: boolean; badge?: string }> = [
  { key: "draw", title: "Draw polygon", description: "Place vertices on an interactive map.", enabled: true },
  { key: "rectangle", title: "Rectangle", description: "Enter west, south, east and north bounds.", enabled: true },
  { key: "geojson", title: "GeoJSON", description: "Import Polygon or MultiPolygon features.", enabled: true },
  { key: "shapefile", title: "Shapefile ZIP", description: "Validated archive with SHP, SHX and DBF.", enabled: true },
  { key: "kml", title: "KML", description: "Import polygon placemarks in WGS84.", enabled: true },
  { key: "gpkg", title: "GeoPackage", description: "Select a polygon layer; the server validates and reprojects it.", enabled: true },
  { key: "admin", title: "Admin boundary", description: "Choose a reviewed boundary from this project's approved catalogue.", enabled: true },
];

function sourceFor(method: Method): SourceType {
  return ({ draw: "drawn_polygon", rectangle: "rectangle_from_coords", geojson: "geojson", shapefile: "shapefile", kml: "kml", gpkg: "gpkg", admin: "admin_boundary" } as const)[method];
}

export function AoiWizard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>("draw");
  const [name, setName] = useState("Untitled AOI");
  const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
  const [featureCount, setFeatureCount] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [gpkgLayers, setGpkgLayers] = useState<string[]>([]);
  const [selectedGpkgLayer, setSelectedGpkgLayer] = useState("");
  const [boundaryQuery, setBoundaryQuery] = useState("");
  const [submittedBoundaryQuery, setSubmittedBoundaryQuery] = useState("");
  const [boundaryOffset, setBoundaryOffset] = useState(0);
  const [selectedBoundary, setSelectedBoundary] = useState<components["schemas"]["AdministrativeBoundaryChoice"] | null>(null);
  const [projectionNote, setProjectionNote] = useState("EPSG:4326");
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [bounds, setBounds] = useState({ west: "36.7", south: "-1.4", east: "37.0", north: "-1.1" });
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => geometry ? estimateGeometryStats(geometry) : null, [geometry]);
  const bbox = useMemo(() => geometry ? getGeometryBoundingBox(geometry) : null, [geometry]);
  const boundarySearch = useQuery({
    queryKey: queryKeys.aois.boundaries(projectId, submittedBoundaryQuery, boundaryOffset),
    queryFn: () => searchAdministrativeBoundaries(projectId, submittedBoundaryQuery, 25, boundaryOffset),
    enabled: method === "admin" && step === 1 && submittedBoundaryQuery.length >= 2,
    retry: false,
  });

  function runBoundarySearch() {
    const searchTerm = boundaryQuery.trim();
    setError(null);
    setSelectedBoundary(null);
    setGeometry(null);
    if (searchTerm.length < 2) {
      setSubmittedBoundaryQuery("");
      setError("Enter at least two characters to search approved boundaries.");
      return;
    }
    setBoundaryOffset(0);
    setSubmittedBoundaryQuery(searchTerm);
    if (submittedBoundaryQuery === searchTerm && boundaryOffset === 0) void boundarySearch.refetch();
  }

  function chooseBoundary(choice: components["schemas"]["AdministrativeBoundaryChoice"]) {
    setSelectedBoundary(choice);
    setGeometry(choice.geometry);
    setFeatureCount(1);
    setProjectionNote("EPSG:4326 (approved catalogue source)");
    setError(null);
  }

  function prepareDraw(nextPoints: Array<[number, number]>) {
    setPoints(nextPoints);
    setGeometry(nextPoints.length >= 3 ? { type: "Polygon", coordinates: [[...nextPoints, nextPoints[0]]] } : null);
    setFeatureCount(nextPoints.length >= 3 ? 1 : 0);
  }

  function prepareRectangle() {
    const values = Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Number(value)])) as Record<keyof typeof bounds, number>;
    if (Object.values(values).some((value) => !Number.isFinite(value)) || values.west >= values.east || values.south >= values.north) throw new Error("Enter valid bounds where west < east and south < north.");
    setGeometry({ type: "Polygon", coordinates: [[[values.west, values.south], [values.east, values.south], [values.east, values.north], [values.west, values.north], [values.west, values.south]]] });
    setFeatureCount(1);
  }

  async function loadFile(selected: File) {
    setError(null); setFile(selected); setGpkgLayers([]); setSelectedGpkgLayer("");
    try {
      if (selected.size > 20 * 1024 * 1024) throw new Error("AOI files must be 20 MB or smaller.");
      if (method === "geojson") {
        const parsed = await parseGeoJsonFile(selected); setGeometry(parsed.geometry); setFeatureCount(parsed.featureCount); setProjectionNote("EPSG:4326 (GeoJSON browser contract)");
      } else if (method === "kml") {
        const parsed = parseKml(await selected.text()); setGeometry(parsed.geometry); setFeatureCount(parsed.featureCount); setProjectionNote("EPSG:4326 (KML coordinates)");
      } else if (method === "gpkg") {
        if (!selected.name.toLowerCase().endsWith(".gpkg")) throw new Error("Select a GeoPackage .gpkg file.");
        const inspected = await inspectGeopackageLayers(projectId, selected);
        const names = inspected.layers.map((layer) => layer.name);
        setGpkgLayers(names);
        setSelectedGpkgLayer(names.length === 1 ? names[0]! : "");
        setGeometry(null); setFeatureCount(0); setProjectionNote("Source CRS validated and reprojected by server");
      } else {
        const parsed = await parseShapefilePreview(selected); setGeometry(parsed.geometry); setFeatureCount(parsed.featureCount); setProjectionNote(parsed.hasProjection ? "Source CRS declared; preview normalized to EPSG:4326" : "CRS not declared; server validation required");
      }
    } catch (caught) { setGeometry(null); setFeatureCount(0); setError(getErrorMessage(caught)); }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("AOI name is required.");
      if (method === "gpkg") {
        if (!file) throw new Error("Select a GeoPackage file.");
        if (!selectedGpkgLayer) throw new Error("Select a GeoPackage polygon layer.");
        return uploadGeopackageAoi(projectId, name.trim(), file, selectedGpkgLayer);
      }
      if (method === "admin") {
        if (!selectedBoundary) throw new Error("Select an approved administrative boundary.");
        return createAoiFromAdministrativeBoundary({
          project_id: projectId,
          dataset_id: selectedBoundary.dataset_id,
          spatial_unit_id: selectedBoundary.spatial_unit_id,
          name: name.trim(),
        });
      }
      if (!geometry) throw new Error("Create or import a valid polygon first.");
      if (method === "shapefile") {
        if (!file) throw new Error("Select a Shapefile ZIP.");
        return uploadShapefileAoi(projectId, name.trim(), file);
      }
      return createAoi({ project_id: projectId, name: name.trim(), crs: "EPSG:4326", source_type: sourceFor(method), geometry });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aois.project(projectId) });
      notify("AOI created", { tone: "success", message: "The boundary is ready for FIRRIS analysis." });
      onClose();
    },
    onError: (caught) => setError(getErrorMessage(caught)),
  });

  function continueWizard() {
    setError(null);
    try {
      if (step === 1 && method === "rectangle") prepareRectangle();
      if (step === 1 && method === "gpkg" && !selectedGpkgLayer) throw new Error("Select a GeoPackage polygon layer.");
      if (step === 1 && method === "admin" && !selectedBoundary) throw new Error("Select an approved administrative boundary.");
      if (step === 1 && !geometry && method !== "rectangle" && !(method === "gpkg" && file)) throw new Error("Create or import a valid polygon to continue.");
      setStep((value) => Math.min(2, value + 1));
    } catch (caught) { setError(getErrorMessage(caught)); }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="aoi-wizard-title">
        <header className="wizard-header"><div><span className="eyebrow">Spatial data</span><h2 id="aoi-wizard-title">Create area of interest</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button></header>
        <ol className="wizard-steps">{["Source", "Configure", "Review"].map((label, index) => <li className={index === step ? "is-active" : index < step ? "is-done" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}</ol>
        <div className="wizard-body">
          {step === 0 ? <div className="method-grid">{methods.map((item) => <button type="button" key={item.key} disabled={!item.enabled} className={`method-card${method === item.key ? " is-selected" : ""}`} onClick={() => { setMethod(item.key); setGeometry(null); setFile(null); setGpkgLayers([]); setSelectedGpkgLayer(""); setBoundaryQuery(""); setSubmittedBoundaryQuery(""); setBoundaryOffset(0); setSelectedBoundary(null); setError(null); }}><Icon name={item.key === "draw" || item.key === "rectangle" ? "aoi" : "upload"} /><span><strong>{item.title}</strong><small>{item.description}</small></span>{item.badge ? <em>{item.badge}</em> : null}</button>)}</div> : null}
          {step === 1 ? <div className="wizard-config"><label className="field"><span>AOI name</span><input value={name} maxLength={255} onChange={(event) => setName(event.target.value)} /></label>{method === "draw" ? <><AoiDrawingMap points={points} onChange={prepareDraw} /><button type="button" className="button button--quiet button--small" onClick={() => prepareDraw([])}>Clear vertices</button></> : null}{method === "rectangle" ? <div className="bounds-grid">{(["west", "south", "east", "north"] as const).map((key) => <label className="field" key={key}><span>{key}</span><input type="number" step="any" value={bounds[key]} onChange={(event) => setBounds((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div> : null}{["geojson", "shapefile", "kml", "gpkg"].includes(method) ? <div className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const selected = event.dataTransfer.files[0]; if (selected) void loadFile(selected); }}><Icon name="upload" /><strong>{file?.name ?? "Drop a file here or browse"}</strong><span>{method === "shapefile" ? "ZIP · SHP + SHX + DBF · maximum 20 MB" : method === "geojson" ? "GeoJSON · Polygon or MultiPolygon" : method === "gpkg" ? "GeoPackage · one polygon layer · maximum 20 MB" : "KML · polygon placemarks"}</span><input ref={inputRef} hidden type="file" accept={method === "shapefile" ? ".zip" : method === "geojson" ? ".json,.geojson" : method === "gpkg" ? ".gpkg" : ".kml"} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void loadFile(selected); }} /></div> : null}{method === "gpkg" && file ? <p className="notice">The GeoPackage boundary is previewed after server validation; source CRS and polygon topology are checked on upload.</p> : null}{geometry ? <AoiGeometryPreview geometry={geometry} crs="EPSG:4326" title="AOI import preview" /> : null}</div> : null}
          {step === 1 && method === "admin" ? (
            <section className="wizard-config" aria-label="Administrative boundary catalogue">
              <div className="notice">Searches only approved boundaries registered to this FIRRIS project. Selection is revalidated by the server when the AOI is created and when analysis runs.</div>
              <label className="field"><span>Boundary name, level or spatial-unit ID</span>
                <input aria-label="Search administrative boundaries" value={boundaryQuery} maxLength={120}
                  onChange={(event) => { setBoundaryQuery(event.target.value); setSubmittedBoundaryQuery(""); setBoundaryOffset(0); setSelectedBoundary(null); setGeometry(null); }}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runBoundarySearch(); } }} />
              </label>
              <button type="button" className="button button--quiet" onClick={runBoundarySearch}>Search approved boundaries</button>
              {!submittedBoundaryQuery ? <p className="notice">Enter at least two characters to search this project's reviewed catalogue. No boundary is selected yet.</p> : null}
              {submittedBoundaryQuery && boundarySearch.isFetching ? <p role="status">Loading approved boundaries…</p> : null}
              {submittedBoundaryQuery && boundarySearch.isError ? <p role="alert">{getErrorMessage(boundarySearch.error)}</p> : null}
              {submittedBoundaryQuery && !boundarySearch.isFetching && boundarySearch.data?.total === 0 ? <p role="status">No approved boundaries matched this search in the current project.</p> : null}
              {boundarySearch.data && submittedBoundaryQuery ? <>
                <p role="status">{boundarySearch.data.total} approved {boundarySearch.data.total === 1 ? "boundary" : "boundaries"} found for “{submittedBoundaryQuery}”.</p>
                <div role="group" aria-label="Approved boundary results">
                  {boundarySearch.data.items.map((choice) => (
                    <button key={`${choice.dataset_id}:${choice.spatial_unit_id}`} type="button" className={`method-card${selectedBoundary?.dataset_id === choice.dataset_id && selectedBoundary.spatial_unit_id === choice.spatial_unit_id ? " is-selected" : ""}`}
                      aria-pressed={selectedBoundary?.dataset_id === choice.dataset_id && selectedBoundary.spatial_unit_id === choice.spatial_unit_id}
                      onClick={() => chooseBoundary(choice)}>
                      <span><strong>{choice.name}</strong><small>{choice.level} · {choice.spatial_unit_id}</small>
                        <small>Producer: {choice.producer} · Source: {choice.source_id} · Licence: {choice.licence_identifier}</small></span>
                    </button>
                  ))}
                </div>
                {boundarySearch.data.total > boundarySearch.data.limit ? <div className="wizard-footer">
                  <button type="button" className="button button--quiet" disabled={boundaryOffset === 0 || boundarySearch.isFetching}
                    onClick={() => setBoundaryOffset(Math.max(0, boundaryOffset - boundarySearch.data.limit))}>Previous boundaries</button>
                  <span>{boundaryOffset + 1}–{Math.min(boundaryOffset + boundarySearch.data.items.length, boundarySearch.data.total)} of {boundarySearch.data.total}</span>
                  <button type="button" className="button button--quiet" disabled={boundaryOffset + boundarySearch.data.limit >= boundarySearch.data.total || boundarySearch.isFetching}
                    onClick={() => setBoundaryOffset(boundaryOffset + boundarySearch.data.limit)}>Next boundaries</button>
                </div> : null}
              </> : null}
              {selectedBoundary ? <dl className="metadata-grid" aria-label="Selected boundary provenance">
                <div><dt>Selected unit</dt><dd>{selectedBoundary.name} ({selectedBoundary.spatial_unit_id})</dd></div>
                <div><dt>Boundary level</dt><dd>{selectedBoundary.level}</dd></div>
                <div><dt>Producer</dt><dd>{selectedBoundary.producer}</dd></div>
                <div><dt>Custodian</dt><dd>{selectedBoundary.custodian}</dd></div>
                <div><dt>Licence</dt><dd>{selectedBoundary.licence_identifier} · {selectedBoundary.permitted_use} · redistribution {selectedBoundary.redistribution}</dd></div>
                <div><dt>Observed</dt><dd>{selectedBoundary.observed_at}</dd></div>
                <div><dt>Reviewed</dt><dd>{selectedBoundary.reviewed_at}</dd></div>
                <div><dt>Positional uncertainty</dt><dd>{selectedBoundary.positional_uncertainty_m} m</dd></div>
                <div><dt>Source version</dt><dd>{selectedBoundary.source_version}</dd></div>
                <div className="span-2"><dt>Source checksum (SHA-256)</dt><dd>{selectedBoundary.source_sha256}</dd></div>
              </dl> : null}
            </section>
          ) : null}
          {step === 2 && geometry && stats && bbox ? <div className="review-layout"><AoiGeometryPreview geometry={geometry} crs="EPSG:4326" title="Final AOI preview" /><div><h3>{name}</h3><dl className="metadata-grid"><div><dt>Source</dt><dd>{methods.find((item) => item.key === method)?.title}</dd></div><div><dt>Geometry</dt><dd>{geometry.type}</dd></div><div><dt>Features</dt><dd>{featureCount}</dd></div><div><dt>CRS</dt><dd>{projectionNote}</dd></div><div><dt>Estimated area</dt><dd>{stats.areaKm2.toFixed(2)} km² · {(stats.areaKm2 * 100).toFixed(2)} ha · {(stats.areaKm2 * 1_000_000).toFixed(0)} m²</dd></div><div><dt>Estimated perimeter</dt><dd>{(stats.perimeterM / 1000).toFixed(2)} km · {stats.perimeterM.toFixed(0)} m</dd></div><div className="span-2"><dt>Bounds</dt><dd>{bbox.west.toFixed(4)}, {bbox.south.toFixed(4)} → {bbox.east.toFixed(4)}, {bbox.north.toFixed(4)}</dd></div></dl><p className="notice">Browser measurements are previews. The API validates and stores authoritative geometry metrics.</p></div></div> : null}
          {step === 2 && method === "admin" && selectedBoundary ? <div className="notice" aria-label="Administrative boundary review"><strong>Approved source:</strong> {selectedBoundary.source_id} · {selectedBoundary.name} ({selectedBoundary.spatial_unit_id}) · producer {selectedBoundary.producer} · licence {selectedBoundary.licence_identifier}. The protected API selects by dataset and spatial-unit ID and persists the verified lineage; the preview geometry is never submitted as authority.</div> : null}
          {step === 2 && method === "gpkg" && file ? <div className="review-layout"><div className="notice"><h3>{name}</h3><p>{file.name} · layer {selectedGpkgLayer}</p><p>Source geometry is not rendered locally. The server revalidates the selected layer, CRS and polygon topology, then returns the normalized AOI.</p></div></div> : null}
          {step === 1 && method === "gpkg" && file && gpkgLayers.length > 0 ? <label className="field"><span>Polygon layer</span><select aria-label="GeoPackage polygon layer" value={selectedGpkgLayer} onChange={(event) => setSelectedGpkgLayer(event.target.value)}><option value="">Select a layer</option>{gpkgLayers.map((layer) => <option key={layer} value={layer}>{layer}</option>)}</select><small>Only vetted polygon layers returned by the protected API are selectable.</small></label> : null}
          {error ? <div className="inline-alert" role="alert">{error}</div> : null}
        </div>
        <footer className="wizard-footer"><button className="button button--quiet" type="button" onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}>{step === 0 ? "Cancel" : "Back"}</button>{step < 2 ? <button className="button button--primary" type="button" onClick={continueWizard}>Continue</button> : <button className="button button--primary" type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Creating…" : "Create AOI"}</button>}</footer>
      </section>
    </div>
  );
}
