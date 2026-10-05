import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProject } from "./projectsApi";

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const project = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
  });

  if (project.isPending) return <LoadingState label="Loading project…" />;
  if (project.isError) return <ErrorState title="Project could not be loaded" error={project.error} onRetry={() => void project.refetch()} />;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <Link className="back-link" to="/projects">← All projects</Link>
          <span className="eyebrow">{project.data.engine_key}</span>
          <h1>{project.data.name}</h1>
          <p>{project.data.description ?? "No project description has been provided."}</p>
        </div>
        <Link className="button button--secondary" to={`/projects/${projectId}/edit`}>Edit project</Link>
      </header>

      <section className="detail-grid" aria-label="Project metadata">
        <article className="metric-card"><span>CRS</span><strong>{project.data.crs}</strong></article>
        <article className="metric-card"><span>Analysis module</span><strong>{project.data.analysis_module}</strong></article>
        <article className="metric-card"><span>Created</span><strong>{formatDate(project.data.created_at)}</strong></article>
        <article className="metric-card"><span>Last updated</span><strong>{formatDate(project.data.updated_at)}</strong></article>
      </section>

      <section className="workflow-grid" aria-label="Project workflows">
        <Link className="workflow-card" to={`/projects/${projectId}/aois`}>
          <span className="workflow-number">01</span><h2>Areas of interest</h2><p>Create and manage analysis boundaries.</p><strong>Manage AOIs →</strong>
        </Link>
        <Link className="workflow-card" to={`/projects/${projectId}/analysis`}>
          <span className="workflow-number">02</span><h2>FIRRIS analysis</h2><p>Select an AOI and flood products to submit.</p><strong>Configure analysis →</strong>
        </Link>
        <Link className="workflow-card" to={`/projects/${projectId}/tasks`}>
          <span className="workflow-number">03</span><h2>Tasks</h2><p>Track queued and running analysis jobs.</p><strong>View tasks →</strong>
        </Link>
        <Link className="workflow-card" to={`/projects/${projectId}/results`}>
          <span className="workflow-number">04</span><h2>Analysis history</h2><p>Inspect result layers, metadata, and protected exports.</p><strong>View history →</strong>
        </Link>
      </section>
    </div>
  );
}
