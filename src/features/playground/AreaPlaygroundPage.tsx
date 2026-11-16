import { useId, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FRRIS_ROUTES } from "../../app/routes";
import { getErrorMessage } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { FRRIS_ENGINE_KEY } from "../../shared/productName";
import { Icon } from "../../shared/ui/Icon";
import { estimateGeometryStats, parseGeoJsonFile, parseKml, parseShapefilePreview } from "../aois/aoiFiles";
import { checkAreaCapacity, createAoi, type AoiCreateRequest } from "../aois/aoisApi";
import type { GeoJsonGeometry } from "../aois/geometry";
import { fetchProjects } from "../projects/projectsApi";
import { PlaygroundMap, type DrawMode } from "./PlaygroundMap";
import { areasToSave, coarserAdvice, currentFigures, featureCollection, mibText, polygonFromPoints, previewPaths, rectangleFromCorners, slug, type Fix, type LonLat } from "./playgroundView";

type Source = AoiCreateRequest["source_type"];

/** r5.1: after Trim, the "Box" figure is the trimmed box, not the original bounding box. */
function trimmedBoxKm2(box: number[]): number {
  const [west, south, east, north] = box as [number, number, number, number];
  return estimateGeometryStats({ type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }).areaKm2;
}

function Preview({ geometries, boxes, label }: { geometries: (GeoJsonGeometry | null | undefined)[]; boxes?: (number[] | null | undefined)[]; label: string }) {
  const paths = previewPaths(geometries, boxes ?? []);
  return (
    <svg className="fr-pg-preview" viewBox="0 0 120 120" role="img" aria-label={label}>
      {paths.rings.map((d, index) => <path key={index} d={d} className={`fr-pg-preview__part fr-pg-preview__part--${index % 4}`} />)}
      {paths.boxes.map((d, index) => <path key={`b${index}`} d={d} className="fr-pg-preview__box" />)}
    </svg>
  );
}

export function AreaPlaygroundPage() {
  const queryClient = useQueryClient();
  const nameId = useId();
  const projectId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<DrawMode>(null);
  const [draft, setDraft] = useState<LonLat[]>([]);
  const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
  const [source, setSource] = useState<Source>("drawn_polygon");
  const [fix, setFix] = useState<Fix>("trim");
  const [applied, setApplied] = useState<Fix | null>(null);
  const [trimCenter, setTrimCenter] = useState<LonLat | null>(null);
  const [name, setName] = useState("New area");
  const [chosenProject, setChosenProject] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ ids: string[]; projectId: string; scale: number } | null>(null);

  const projects = useQuery({ queryKey: queryKeys.projects.all, queryFn: fetchProjects });
  const frrisProjects = useMemo(() => (projects.data ?? []).filter((project) => project.engine_key === FRRIS_ENGINE_KEY), [projects.data]);
  const project = chosenProject || frrisProjects[0]?.id || "";

  const check = useQuery({
    queryKey: ["aois", "capacity", geometry, trimCenter],
    queryFn: () => checkAreaCapacity({ geometry: geometry!, scale_m: 30, trim_center: trimCenter }),
    enabled: geometry !== null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const data = geometry ? check.data : undefined;
  const figures = data ? currentFigures(data, applied) : null;
  const over = data?.status === "over";
  const canSave = Boolean(data) && (!over || (applied !== null && (applied !== "trim" || data?.trim) && (applied !== "split" || data?.split) && (applied !== "coarser" || data?.coarser)));
  const toSave = data && geometry ? areasToSave(data, applied, geometry, name.trim() || "New area") : [];

  function reset(next: GeoJsonGeometry | null, nextSource: Source) {
    setGeometry(next); setSource(nextSource); setApplied(null); setTrimCenter(null); setSaved(null); setFileError(null); setDraft([]); setMode(null);
  }
  function finish(points: LonLat[]) {
    const shape = mode === "rectangle" ? rectangleFromCorners(points[0]!, points[1]!) : polygonFromPoints(points);
    if (shape) reset(shape, mode === "rectangle" ? "rectangle_from_coords" : "drawn_polygon");
  }
  async function upload(file: File) {
    try {
      const lower = file.name.toLowerCase();
      const parsed = lower.endsWith(".zip") ? await parseShapefilePreview(file)
        : lower.endsWith(".kml") ? parseKml(await file.text())
        : await parseGeoJsonFile(file);
      reset(parsed.geometry, lower.endsWith(".zip") ? "shapefile" : lower.endsWith(".kml") ? "kml" : "geojson");
      if (name === "New area") setName(file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      setFileError(getErrorMessage(error));
    }
  }
  function moveTrim(dx: number, dy: number) {
    const box = data?.trim?.box;
    if (!box) return;
    const [west, south, east, north] = box as [number, number, number, number];
    setTrimCenter([(west + east) / 2 + dx * (east - west), (south + north) / 2 + dy * (north - south)]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("Choose a project for the area.");
      const ids: string[] = [];
      for (const area of toSave) ids.push((await createAoi({ project_id: project, name: area.name, geometry: area.geometry, source_type: source, crs: "EPSG:4326" })).id);
      return ids;
    },
    onSuccess: (ids) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aois.project(project) });
      setSaved({ ids, projectId: project, scale: figures?.scale ?? 30 });
    },
  });

  function download() {
    const blob = new Blob([JSON.stringify(featureCollection(toSave, figures?.scale ?? 30), null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${slug(name)}.geojson`;
    document.body.append(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  }

  const partLabels = applied === "split" && data?.split ? data.split.parts.map((part, index) => ({ geometry: part.geometry, label: `${index + 1}/${data.split!.parts.length} · ${mibText(part.capacity.estimated_request_bytes)} MiB` })) : [];
  const percent = figures ? Math.min(100, (figures.bytes / figures.limit) * 100) : 0;

  return <div className="fr-pg">
    <div className="fr-pg__main">
      <header className="fr-page-header__text">
        <h1>Area playground</h1>
        <p>Draw or upload an area. FRRIS checks that it fits one analysis and helps you trim it before you save it.</p>
      </header>
      <section className="fr-card fr-section" aria-label="Area">
        <div role="toolbar" aria-label="Area tools" className="fr-pg-tools">
          <button type="button" className="fr-button fr-button--secondary" aria-pressed={mode === "polygon"} onClick={() => { setMode("polygon"); setDraft([]); }}><Icon name="aoi" width={16} height={16} />Polygon</button>
          <button type="button" className="fr-button fr-button--secondary" aria-pressed={mode === "rectangle"} onClick={() => { setMode("rectangle"); setDraft([]); }}><Icon name="overview" width={16} height={16} />Rectangle</button>
          <button type="button" className="fr-button fr-button--secondary" onClick={() => fileInput.current?.click()}><Icon name="upload" width={16} height={16} />Upload GeoJSON / Shapefile / KML</button>
          <button type="button" className="fr-button fr-button--secondary" onClick={() => reset(null, "drawn_polygon")} disabled={!geometry && !draft.length}>Clear</button>
          <input ref={fileInput} type="file" hidden accept=".json,.geojson,.zip,.kml" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
        </div>
        {mode === "polygon" ? <p className="fr-help" role="status">Click the map to add corners; double-click or press Finish to close the shape. {draft.length} corners.
          {" "}<button type="button" className="fr-link-button" disabled={draft.length < 3} onClick={() => finish(draft)}>Finish</button></p> : null}
        {mode === "rectangle" ? <p className="fr-help" role="status">{draft.length ? "Click the opposite corner." : "Click one corner of the rectangle."}</p> : null}
        {fileError ? <p className="fr-box fr-box--danger" role="alert">{fileError}</p> : null}
        <PlaygroundMap mode={mode} draft={draft} onDraft={setDraft} onFinish={finish} area={applied === "trim" && data?.trim ? data.trim.geometry : geometry}
          trimBox={applied === "trim" ? data?.trim?.box ?? null : null} onMoveTrim={(center) => setTrimCenter(center)} parts={partLabels} />
        {data ? <p className="fr-pg-stats" aria-label="Area figures">
          <span>Area <span className="fr-num">{(figures?.areaKm2 ?? data.area_km2).toLocaleString("en-GB", { maximumFractionDigits: 1 })}</span> km²</span>
          <span>Box <span className="fr-num">{applied === "split" && data.split ? `${data.split.parts.length} parts`
            : applied === "trim" && data.trim ? `${trimmedBoxKm2(data.trim.box).toLocaleString("en-GB", { maximumFractionDigits: 0 })} km² (trimmed)`
            : `${data.bbox_km2.toLocaleString("en-GB", { maximumFractionDigits: 0 })} km²`}</span></span>
          <span>Resolution <span className="fr-num">{figures?.scale ?? 30}</span> m</span>
        </p> : null}
        {applied === "trim" && data?.trim ? <div className="fr-pg-move" role="group" aria-label="Move the trimmed box">
          <span>Move the box:</span>
          {([["West", -0.25, 0], ["North", 0, 0.25], ["South", 0, -0.25], ["East", 0.25, 0]] as const).map(([label, dx, dy]) => (
            <button key={label} type="button" className="fr-button fr-button--secondary fr-button--small" onClick={() => moveTrim(dx, dy)}>{label}</button>
          ))}
        </div> : null}
        <p className="fr-help">The download size depends on the rectangle around your area (the box), not only on the area itself: a long, diagonal shape can be small but still too large to download.</p>
      </section>
    </div>

    <aside className="fr-pg__aside" aria-label="Area check">
      <section className="fr-card fr-section" aria-live="polite" aria-labelledby="pg-fits">
        <h2 id="pg-fits">Fits one analysis?</h2>
        {!geometry ? <p className="fr-help">Draw or upload an area to check it.</p> : check.isError && !data ? <p className="fr-box fr-box--danger" role="alert">{getErrorMessage(check.error)}</p> : !data || !figures ? <p className="fr-help" role="status">Checking…</p> : <>
          <div className="fr-meter__label"><span>Download estimate</span><span className="fr-num">{mibText(figures.bytes)} / {mibText(figures.limit)} MiB</span></div>
          <div className="fr-meter__track" role="img" aria-label={`${mibText(figures.bytes)} of ${mibText(figures.limit)} MiB`}><div className={`fr-meter__bar fr-meter__bar--${figures.tone}`} style={{ width: `${percent}%` }} /></div>
          <p className={`fr-box ${figures.tone === "ok" ? "fr-box--success" : figures.tone === "near" ? "fr-box--warning" : "fr-box--danger"}`} role="status">{figures.message}</p>
        </>}
      </section>

      {over && data ? (
        <section className="fr-card fr-section" aria-labelledby="pg-fix">
          <h2 id="pg-fix">Make it fit</h2>
          <fieldset className="fr-choice-list">
            <legend>Choose how to fit the area</legend>
            {data.trim ? <label className={`fr-choice${fix === "trim" ? " is-selected" : ""}`}>
              <input type="radio" name="pg-fix" checked={fix === "trim"} onChange={() => { setFix("trim"); setApplied(null); }} />
              <span><strong>Trim to the largest box that fits</strong><small>About <span className="fr-num">{data.trim.area_km2.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span> km² of your area, centred on it; you can move the box. <span className="fr-num">{mibText(data.trim.capacity.estimated_request_bytes)}</span> MiB.</small></span>
              <Preview geometries={[geometry, data.trim.geometry]} boxes={[data.trim.box]} label="Preview: the trimmed box on the area" />
            </label> : null}
            {data.split ? <label className={`fr-choice${fix === "split" ? " is-selected" : ""}`}>
              <input type="radio" name="pg-fix" checked={fix === "split"} onChange={() => { setFix("split"); setApplied(null); }} />
              <span><strong>Split into {data.split.parts.length} parts</strong><small>Each part is saved as its own area and run as its own analysis. Up to <span className="fr-num">{mibText(Math.max(...data.split.parts.map((part) => part.capacity.estimated_request_bytes)))}</span> MiB each.</small></span>
              <Preview geometries={data.split.parts.map((part) => part.geometry)} label={`Preview: the area split into ${data.split.parts.length} parts`} />
            </label> : null}
            {data.coarser ? <label className={`fr-choice${fix === "coarser" ? " is-selected" : ""}`}>
              <input type="radio" name="pg-fix" checked={fix === "coarser"} onChange={() => { setFix("coarser"); setApplied(null); }} />
              <span><strong>Use {data.coarser.scale_m} m resolution</strong><small>Keeps the whole area (<span className="fr-num">{mibText(data.coarser.capacity.estimated_request_bytes)}</span> MiB). {coarserAdvice(data.coarser.scale_m, Boolean(data.split)).detail}</small>
                {coarserAdvice(data.coarser.scale_m, Boolean(data.split)).recommendSplit ? <small className="fr-pg-advice"><strong>Recommended: Split</strong> keeps the 30 m detail; choose it unless you only need an overview.</small> : null}</span>
              <Preview geometries={[geometry]} label="Preview: the whole area" />
            </label> : null}
          </fieldset>
          <button type="button" className="fr-button fr-button--primary" onClick={() => setApplied(fix)} disabled={applied === fix}>{applied === fix ? "Applied" : "Apply"}</button>
        </section>
      ) : null}

      <section className="fr-card fr-section" aria-labelledby="pg-save">
        <h2 id="pg-save">Save the area</h2>
        <label className="fr-field" htmlFor={nameId}><span>Name</span><input id={nameId} value={name} maxLength={200} onChange={(event) => setName(event.target.value)} /></label>
        <label className="fr-field" htmlFor={projectId}><span>Project</span>
          <select id={projectId} value={project} onChange={(event) => setChosenProject(event.target.value)}>
            {frrisProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {saved ? <div className="fr-box fr-box--success" role="status"><span>Saved {saved.ids.length === 1 ? "the area" : `${saved.ids.length} areas`}. <Link to={`${FRRIS_ROUTES.newAnalysis}?project=${encodeURIComponent(saved.projectId)}&aoi_id=${encodeURIComponent(saved.ids[0]!)}${saved.scale !== 30 ? `&scale=${saved.scale}` : ""}`}>Start a new analysis</Link></span></div> : null}
        {save.isError ? <p className="fr-box fr-box--danger" role="alert">{getErrorMessage(save.error)}</p> : null}
        <div className="fr-pg-actions">
          <button type="button" className="fr-button fr-button--primary" disabled={!canSave || !project || save.isPending || Boolean(saved)} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : toSave.length > 1 ? `Save ${toSave.length} areas` : "Save to my areas"}
          </button>
          <button type="button" className="fr-button fr-button--secondary" disabled={!canSave} onClick={download}>Download GeoJSON</button>
        </div>
        {over && !canSave ? <p className="fr-help">Make the area fit first: choose an option above and press Apply.</p> : null}
        <p className="fr-help">Saved areas appear in New analysis. The size check uses the same rule as the analysis itself.</p>
      </section>
    </aside>
  </div>;
}
