import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProject } from "./projectsApi";

const tabs = [
  ["", "Overview"], ["aois", "AOI"], ["data", "Data"], ["analysis", "Analysis"], ["tasks", "Tasks"],
  ["results", "Results"], ["map", "Map"], ["reports", "Reports"], ["exports", "Exports"],
] as const;

export function ProjectWorkspaceLayout() {
  const { projectId = "" } = useParams();
  const project = useQuery({ queryKey: queryKeys.projects.detail(projectId), queryFn: () => fetchProject(projectId), enabled: Boolean(projectId) });
  if (project.isPending) return <LoadingState label="Opening project workspace…" />;
  if (project.isError) return <ErrorState title="Project could not be loaded" error={project.error} />;
  return <div className="project-workspace">
    <header className="project-masthead"><div><div className="project-kicker"><span className="engine-pill">{project.data.engine_key.toUpperCase()}</span><span>{project.data.crs}</span></div><h1>{project.data.name}</h1><p>{project.data.description || "Geospatial risk analysis workspace"}</p></div><div className="project-actions"><NavLink className="button button--quiet" to={`/projects/${projectId}/edit`}>Project settings</NavLink><NavLink className="button button--primary" to="analysis">New analysis</NavLink></div></header>
    <nav className="workspace-tabs" aria-label="Project workspace">{tabs.map(([path, label]) => <NavLink key={label} end={path === ""} to={path || "."} className={({ isActive }) => isActive ? "is-active" : ""}>{label}</NavLink>)}</nav>
    <Outlet />
  </div>;
}
