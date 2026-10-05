import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchProjects } from "../projects/projectsApi";
import { fetchTasks } from "../tasks/tasksApi";
import { fetchResults } from "../results/resultsApi";
import { queryKeys } from "../../shared/api/queryKeys";
import { useOrganizationContext } from "../organization/OrganizationContext";
import { TaskStatusBadge } from "../tasks/TaskStatusBadge";

export function DashboardPage() {
  const organization = useOrganizationContext();
  const projects = useQuery({ queryKey: queryKeys.projects.all, queryFn: fetchProjects });
  const tasks = useQuery({ queryKey: queryKeys.tasks.list({ limit: 8 }), queryFn: () => fetchTasks({ limit: 8 }) });
  const results = useQuery({ queryKey: queryKeys.results.list({ limit: 8 }), queryFn: () => fetchResults({ limit: 8 }) });
  const active = tasks.data?.items.filter((task) => task.status === "queued" || task.status === "running").length ?? 0;
  return <div className="page-stack dashboard-page">
    <header className="page-heading"><div><span className="eyebrow">Operations overview</span><h1>{organization.current_organization.name}</h1><p>Monitor geospatial projects, active analyses and the latest FIRRIS intelligence.</p></div><Link className="button button--primary" to="/projects/new">+ New project</Link></header>
    <section className="metric-grid" aria-label="Workspace metrics">
      <article className="metric-card"><span>Projects</span><strong>{projects.data?.length ?? "—"}</strong><small>Organization workspaces</small></article>
      <article className="metric-card"><span>Active tasks</span><strong>{active}</strong><small>Queued or processing</small></article>
      <article className="metric-card"><span>Results</span><strong>{results.data?.total ?? "—"}</strong><small>Protected analysis outputs</small></article>
      <article className="metric-card metric-card--accent"><span>Engine</span><strong>FIRRIS</strong><small>Flood intelligence reference engine</small></article>
    </section>
    <div className="dashboard-grid">
      <section className="panel"><header className="panel-heading"><div><span className="eyebrow">Recent activity</span><h2>Analysis tasks</h2></div><Link to="/tasks">View all</Link></header><div className="activity-list">{tasks.data?.items.slice(0, 6).map((task) => <Link className="activity-row" to={`/tasks/${task.task_id}`} key={task.task_id}><span className="activity-icon">↻</span><span><strong>{task.task_type.replaceAll("_", " ")}</strong><small>{new Date(task.created_at).toLocaleString()}</small></span><TaskStatusBadge status={task.status} /></Link>)}{tasks.data?.items.length === 0 ? <div className="empty-state compact"><p>No analysis activity yet.</p></div> : null}</div></section>
      <aside className="panel quick-start"><span className="eyebrow">Quick start</span><h2>Launch a FIRRIS workflow</h2><ol><li><span>1</span>Create a FIRRIS project</li><li><span>2</span>Add a validated AOI</li><li><span>3</span>Configure satellite analysis</li><li><span>4</span>Explore and export results</li></ol><Link className="button button--secondary" to="/projects">Open projects</Link></aside>
    </div>
  </div>;
}
