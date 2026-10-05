import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProjects } from "./projectsApi";

const copy = {
  aois: ["Areas of interest", "Open a project to create and manage analysis boundaries."],
  analysis: ["Analyses", "Configure a guided FIRRIS satellite workflow inside a project."],
  map: ["Maps", "Explore completed FIRRIS result layers in their project context."],
  reports: ["Reports", "Review protected analysis summaries, metadata and provenance."],
  exports: ["Exports", "Access authorized GIS, report and package downloads."],
} as const;

export function PortfolioCapabilityPage({ mode }: { mode: keyof typeof copy }) {
  const projects = useQuery({ queryKey: queryKeys.projects.all, queryFn: fetchProjects });
  if (projects.isPending) return <LoadingState label={`Loading ${copy[mode][0].toLowerCase()}…`} />;
  if (projects.isError) return <ErrorState title="Projects could not be loaded" error={projects.error} />;
  return <div className="page-stack"><header className="page-heading"><div><span className="eyebrow">Organization portfolio</span><h1>{copy[mode][0]}</h1><p>{copy[mode][1]}</p></div></header><div className="portfolio-grid">{projects.data.map((project) => <article className="portfolio-card" key={project.id}><div><span className="engine-pill">{project.engine_key}</span><h2>{project.name}</h2><p>{project.description || "Geospatial analysis project"}</p><small>{project.crs} · updated {new Date(project.updated_at).toLocaleDateString()}</small></div><Link className="button button--secondary" to={`/projects/${project.id}/${mode}`}>Open {copy[mode][0].toLowerCase()}</Link></article>)}{projects.data.length === 0 ? <div className="panel empty-state"><h3>No projects available</h3><p>Create a project before using this workspace.</p><Link className="button button--primary" to="/projects/new">New project</Link></div> : null}</div></div>;
}
