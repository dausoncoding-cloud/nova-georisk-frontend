import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { useAvailableEngines } from "../engines/engineQueries";
import { createProject, deleteProject, fetchProject, updateProject } from "./projectsApi";

export function ProjectFormPage() {
  const { projectId } = useParams();
  const isEditing = Boolean(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const engines = useAvailableEngines();
  const project = useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? "new"),
    queryFn: () => fetchProject(projectId as string),
    enabled: isEditing,
  });
  const firrisEngines = (engines.data ?? []).filter((engine) => engine.name.trim().toUpperCase() === "FIRRIS" && engine.access !== false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [crs, setCrs] = useState("EPSG:4326");
  const [engineKey, setEngineKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (project.data) {
      setName(project.data.name);
      setDescription(project.data.description ?? "");
      setCrs(project.data.crs);
      setEngineKey(project.data.engine_key);
    }
  }, [project.data]);

  useEffect(() => {
    if (!isEditing && !engineKey && firrisEngines[0]) setEngineKey(firrisEngines[0].key);
  }, [engineKey, firrisEngines, isEditing]);

  const save = useMutation({
    mutationFn: () =>
      isEditing
        ? updateProject(projectId as string, { name: name.trim(), description: description.trim() || null, crs: crs.trim() })
        : createProject({
            name: name.trim(),
            description: description.trim() || null,
            crs: crs.trim(),
            engine_key: engineKey,
          }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.projects.detail(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      navigate(`/projects/${saved.id}`, { replace: true });
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteProject(projectId as string),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId as string) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      navigate("/projects", { replace: true });
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim() || !crs.trim() || (!isEditing && !engineKey)) {
      setFormError("Name, CRS, and a FIRRIS engine are required.");
      return;
    }
    save.mutate();
  }

  if (isEditing && project.isPending) return <LoadingState label="Loading project…" />;
  if (isEditing && project.isError) return <ErrorState title="Project could not be loaded" error={project.error} />;

  return (
    <div className="narrow-page">
      <Link className="back-link" to={isEditing ? `/projects/${projectId}` : "/projects"}>← Back</Link>
      <header className="page-heading"><div><span className="eyebrow">Project workflow</span><h1>{isEditing ? "Edit project" : "Create project"}</h1><p>Projects define the organization-scoped container and analysis engine.</p></div></header>
      <form className="panel form-panel" onSubmit={submit}>
        <label className="field"><span>Project name</span><input value={name} maxLength={255} required onChange={(event) => setName(event.target.value)} /></label>
        <label className="field"><span>Description</span><textarea value={description} maxLength={10000} rows={4} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="form-row">
          <label className="field"><span>Coordinate reference system</span><input value={crs} maxLength={32} required onChange={(event) => setCrs(event.target.value)} /></label>
          <label className="field"><span>Analysis engine</span>
            <select value={engineKey} disabled={isEditing || engines.isPending} required={!isEditing} onChange={(event) => setEngineKey(event.target.value)}>
              <option value="">Select FIRRIS</option>
              {firrisEngines.map((engine) => <option key={engine.key} value={engine.key}>{engine.name} · {engine.version}</option>)}
              {isEditing && engineKey && !firrisEngines.some((engine) => engine.key === engineKey) ? <option value={engineKey}>{engineKey}</option> : null}
            </select>
          </label>
        </div>
        {!isEditing && engines.isSuccess && firrisEngines.length === 0 ? <div className="inline-alert" role="alert">FIRRIS is not currently available to this organization.</div> : null}
        {formError ? <div className="inline-alert" role="alert">{formError}</div> : null}
        <div className="form-actions"><button className="button button--primary" type="submit" disabled={save.isPending || (!isEditing && firrisEngines.length === 0)}>{save.isPending ? "Saving…" : isEditing ? "Save changes" : "Create project"}</button><Link className="button button--quiet" to={isEditing ? `/projects/${projectId}` : "/projects"}>Cancel</Link></div>
      </form>
      {isEditing ? <section className="danger-zone"><div><h2>Delete project</h2><p>Only an empty project can be deleted. Analysis history is never removed implicitly.</p></div><button className="button button--danger" type="button" disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete ${project.data?.name ?? "this project"}?`)) remove.mutate(); }}>{remove.isPending ? "Deleting…" : "Delete project"}</button></section> : null}
    </div>
  );
}
