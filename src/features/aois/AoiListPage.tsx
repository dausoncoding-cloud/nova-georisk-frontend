import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProject } from "../projects/projectsApi";
import { deleteAoi, fetchProjectAois, updateAoi, type AoiResponse } from "./aoisApi";
import { AoiGeometryPreview } from "./AoiGeometryPreview";
import { AoiWizard } from "./AoiWizard";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function AoiRow({ aoi, projectId }: { aoi: AoiResponse; projectId: string }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(aoi.name);
  const [error, setError] = useState<string | null>(null);
  const rename = useMutation({
    mutationFn: () => updateAoi(aoi.id, { name: name.trim() }),
    onSuccess: () => {
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.aois.project(projectId) });
      queryClient.removeQueries({ queryKey: queryKeys.aois.detail(aoi.id) });
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError)),
  });
  const remove = useMutation({
    mutationFn: () => deleteAoi(aoi.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aois.project(projectId) });
      queryClient.removeQueries({ queryKey: queryKeys.aois.detail(aoi.id) });
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError)),
  });

  return (
    <article className="aoi-card">
      <div className="aoi-card__main">
        {isEditing ? (
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) rename.mutate(); }}>
            <input aria-label="AOI name" value={name} maxLength={255} onChange={(event) => setName(event.target.value)} />
            <button className="button button--small button--primary" type="submit" disabled={rename.isPending}>Save</button>
            <button className="button button--small button--quiet" type="button" onClick={() => { setName(aoi.name); setIsEditing(false); }}>Cancel</button>
          </form>
        ) : <><div><span className="eyebrow">{aoi.source_type.replaceAll("_", " ")}</span><h3>{aoi.name}</h3></div><span className="crs-chip">{aoi.crs}</span></>}
        <dl className="aoi-stats">
          <div><dt>Area</dt><dd>{numberFormatter.format(aoi.stats.area_km2)} km²</dd></div>
          <div><dt>Perimeter</dt><dd>{numberFormatter.format(aoi.stats.perimeter_m / 1000)} km</dd></div>
          <div><dt>Geometry</dt><dd>{aoi.geometry.type}</dd></div>
        </dl>
        <AoiGeometryPreview geometry={aoi.geometry} crs={aoi.crs} title={`${aoi.name} boundary`} />
      </div>
      <div className="aoi-card__actions">
        <Link className="button button--small button--primary" to={`/projects/${projectId}/analysis?aoi_id=${encodeURIComponent(aoi.id)}`}>Analyze</Link>
        <button className="button button--small button--quiet" type="button" onClick={() => { setError(null); setIsEditing(true); }}>Rename</button>
        <button className="button button--small button--danger-quiet" type="button" disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete AOI ${aoi.name}?`)) remove.mutate(); }}>Delete</button>
      </div>
      {error ? <div className="card-error" role="alert">{error}</div> : null}
    </article>
  );
}

export function AoiListPage() {
  const { projectId = "" } = useParams();
  const project = useQuery({ queryKey: queryKeys.projects.detail(projectId), queryFn: () => fetchProject(projectId), enabled: Boolean(projectId) });
  const aois = useQuery({ queryKey: queryKeys.aois.project(projectId), queryFn: () => fetchProjectAois(projectId), enabled: Boolean(projectId) });
  const [showCreate, setShowCreate] = useState(false);

  if (project.isPending || aois.isPending) return <LoadingState label="Loading areas of interest…" />;
  if (project.isError) return <ErrorState title="Project could not be loaded" error={project.error} />;
  if (aois.isError) return <ErrorState title="Areas of interest could not be loaded" error={aois.error} onRetry={() => void aois.refetch()} />;

  return (
    <div className="page-stack">
      <header className="page-heading"><div><Link className="back-link" to={`/projects/${projectId}`}>← {project.data.name}</Link><span className="eyebrow">Spatial inputs</span><h1>Areas of interest</h1><p>Create, validate and manage analysis-ready spatial boundaries.</p></div><button className="button button--primary" type="button" onClick={() => setShowCreate(true)}>+ New AOI</button></header>
      {showCreate ? <AoiWizard projectId={projectId} onClose={() => setShowCreate(false)} /> : null}

      <section className="aoi-list" aria-label="Project areas of interest">
        {aois.data.items.length === 0 ? <div className="panel empty-state"><div className="empty-icon" aria-hidden="true">◇</div><h3>No AOIs yet</h3><p>Create a GeoJSON boundary before submitting a FIRRIS analysis.</p></div> : aois.data.items.map((aoi) => <AoiRow key={aoi.id} aoi={aoi} projectId={projectId} />)}
      </section>
    </div>
  );
}
