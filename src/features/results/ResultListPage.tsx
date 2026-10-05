import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProject } from "../projects/projectsApi";
import { fetchTasks } from "../tasks/tasksApi";
import { TaskStatusBadge } from "../tasks/TaskStatusBadge";
import { fetchResults, type ResultFilters } from "./resultsApi";

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ResultListPage() {
  const { projectId } = useParams();
  const filters: ResultFilters = { project_id: projectId, limit: 50, offset: 0 };
  const results = useQuery({ queryKey: queryKeys.results.list(filters), queryFn: () => fetchResults(filters) });
  const tasks = useQuery({
    queryKey: queryKeys.tasks.list({ project_id: projectId, limit: 50, offset: 0 }),
    queryFn: () => fetchTasks({ project_id: projectId, limit: 50, offset: 0 }),
    refetchInterval: (query) => query.state.data?.items.some((task) => task.status === "queued" || task.status === "running") ? 5_000 : false,
  });
  const project = useQuery({ queryKey: queryKeys.projects.detail(projectId ?? "global"), queryFn: () => fetchProject(projectId as string), enabled: Boolean(projectId) });

  if (results.isPending || tasks.isPending || (projectId && project.isPending)) return <LoadingState label="Loading analysis history…" />;
  if (results.isError) return <ErrorState title="Results could not be loaded" error={results.error} onRetry={() => void results.refetch()} />;
  if (project.isError) return <ErrorState title="Project could not be loaded" error={project.error} />;
  if (tasks.isError) return <ErrorState title="Analysis history could not be loaded" error={tasks.error} onRetry={() => void tasks.refetch()} />;

  return (
    <div className="page-stack">
      <header className="page-heading"><div>{projectId ? <Link className="back-link" to={`/projects/${projectId}`}>← {project.data?.name}</Link> : null}<span className="eyebrow">FIRRIS lifecycle</span><h1>Analysis history</h1><p>Submitted runs, worker state, and versioned outputs for the current organization.</p></div><span className="phase-chip">{results.data.total} result{results.data.total === 1 ? "" : "s"}</span></header>
      <section className="panel"><div className="panel-heading"><div><h2>Analysis runs</h2><p>Queued, active, completed, and failed executions.</p></div><span className="count-badge">{tasks.data.total}</span></div>{tasks.data.items.length === 0 ? <div className="empty-state"><h3>No analyses submitted</h3><p>Create an AOI and submit a FIRRIS analysis.</p></div> : <div className="table-wrap"><table><thead><tr><th>Status</th><th>Analysis</th><th>Progress</th><th>Submitted</th></tr></thead><tbody>{tasks.data.items.map((task) => <tr key={task.id}><td><TaskStatusBadge status={task.status} /></td><td><Link className="table-link" to={`/tasks/${task.task_id}`}><strong>{task.task_type.replaceAll("_", " ")}</strong></Link><span>{task.task_id}</span></td><td>{task.progress_pct}%</td><td>{formatDate(task.created_at)}</td></tr>)}</tbody></table></div>}</section>
      <div className="section-heading"><div><span className="eyebrow">Completed outputs</span><h2>Versioned results</h2></div></div>
      <section className="result-grid">{results.data.items.length === 0 ? <div className="panel empty-state"><div className="empty-icon" aria-hidden="true">□</div><h3>No results yet</h3><p>Completed FIRRIS analyses will appear here.</p></div> : results.data.items.map((result) => <Link className="result-card" to={`/results/${result.id}`} key={result.id}><div><span className="engine-key">{result.engine_key}</span><span className="version-chip">v{result.version}</span></div><h2>{result.result_type.replaceAll("_", " ")}</h2><p>{result.products.length} protected product{result.products.length === 1 ? "" : "s"}</p><footer><span>{formatDate(result.created_at)}</span><strong>View result →</strong></footer></Link>)}</section>
    </div>
  );
}
