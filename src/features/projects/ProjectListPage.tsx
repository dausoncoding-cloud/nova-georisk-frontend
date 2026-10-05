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
  const projects = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: fetchProjects,
    staleTime: 30_000,
  });

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>Projects</h1>
          <p>Organization-scoped analysis workspaces available to your NOVA membership.</p>
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
            <table>
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Engine</th>
                  <th scope="col">CRS</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.data.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <Link className="table-link" to={`/projects/${project.id}`}><strong>{project.name}</strong></Link>
                      <span>{project.description ?? "No description"}</span>
                    </td>
                    <td><span className="engine-key">{project.engine_key}</span></td>
                    <td>{project.crs}</td>
                    <td>{dateFormatter.format(new Date(project.updated_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
