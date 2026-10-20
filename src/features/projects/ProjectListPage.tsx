import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { OrganizationSummaryCard } from "../organization/OrganizationSummaryCard";
import { fetchProjects } from "./projectsApi";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function ProjectListPage() {
  const [query, setQuery] = useState("");
  const projects = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: fetchProjects,
    staleTime: 30_000,
  });

  const filtered = (projects.data ?? []).filter(project => `${project.name} ${project.description ?? ""} ${project.crs} ${project.engine_key}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>Projects</h1>
          <p>Manage project boundaries, analyses and results.</p>
        </div>
        <Link className="button button--primary" to="/projects/new">New project</Link>
      </header>

      <OrganizationSummaryCard />

      <section className="panel" aria-labelledby="project-list-heading">
        <div className="panel-heading">
          <div>
            <h2 id="project-list-heading">Project register</h2>
            <p>Select a project to manage its AOIs, analyses, tasks, and results.</p>
          </div>
          {projects.data ? <span className="count-badge">{projects.data.length}</span> : null}
        </div>

        <div className="table-tools"><label className="field"><span>Search projects</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, engine or CRS" /></label><span role="status">{filtered.length} projects</span></div>
        {projects.isPending ? <LoadingState label="Loading projects…" /> : null}
        {projects.isError ? (
          <ErrorState
            title="Projects could not be loaded"
            error={projects.error}
            onRetry={() => void projects.refetch()}
          />
        ) : null}
        {projects.data?.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">◇</div>
            <h3>No projects yet</h3>
            <p>Create the first FIRRIS project for this organization.</p>
          </div>
        ) : null}
        {projects.data && projects.data.length > 0 ? (
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Engine</th>
                  <th scope="col">CRS</th>
                  <th scope="col">Updated</th><th scope="col">Quick access</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr key={project.id}>
                    <td data-label="Project">
                      <Link className="table-link" to={`/projects/${project.id}`}><strong>{project.name}</strong></Link>
                      <span>{project.description ?? "No description"}</span>
                    </td>
                    <td data-label="Engine"><span className="engine-key">{project.engine_key}</span></td>
                    <td data-label="CRS">{project.crs}</td>
                    <td data-label="Updated">{dateFormatter.format(new Date(project.updated_at))}</td><td data-label="Quick access"><div className="row-links"><Link to={`/projects/${project.id}/analysis`}>New analysis<span className="sr-only"> for {project.name}</span></Link><Link to={`/projects/${project.id}/tasks`}>Tasks<span className="sr-only"> for {project.name}</span></Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {projects.data?.length && filtered.length === 0 ? <div className="empty-state"><h3>No matching projects</h3><button className="button button--quiet" onClick={() => setQuery("")}>Clear search</button></div> : null}
      </section>
    </div>
  );
}
