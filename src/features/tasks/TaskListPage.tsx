import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchProject } from "../projects/projectsApi";
import { fetchTasks, type TaskFilters, type TaskStatus } from "./tasksApi";
import { TaskStatusBadge } from "./TaskStatusBadge";

const statuses: TaskStatus[] = ["queued", "running", "completed", "failed", "canceled"];
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function TaskListPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const status = statuses.find((item) => item === requestedStatus);
  const filters: TaskFilters = { project_id: projectId, status, limit: 50, offset: 0 };
  const tasks = useQuery({ queryKey: queryKeys.tasks.list(filters), queryFn: () => fetchTasks(filters), refetchInterval: (query) => query.state.data?.items.some((task) => task.status === "queued" || task.status === "running") ? 5_000 : false });
  const project = useQuery({ queryKey: queryKeys.projects.detail(projectId ?? "global"), queryFn: () => fetchProject(projectId as string), enabled: Boolean(projectId) });

  if (tasks.isPending || (projectId && project.isPending)) return <LoadingState label="Loading tasks…" />;
  if (tasks.isError) return <ErrorState title="Tasks could not be loaded" error={tasks.error} onRetry={() => void tasks.refetch()} />;
  if (project.isError) return <ErrorState title="Project could not be loaded" error={project.error} />;

  const setStatus = (nextStatus?: TaskStatus) => {
    const next = new URLSearchParams(searchParams);
    if (nextStatus) next.set("status", nextStatus); else next.delete("status");
    setSearchParams(next);
  };
  const activeCount = tasks.data.items.filter((task) => task.status === "running" || task.status === "queued").length;
  const failedCount = tasks.data.items.filter((task) => task.status === "failed").length;

  return (
    <div className="page-stack">
      <header className="page-heading"><div>{projectId ? <Link className="back-link" to={`/projects/${projectId}`}>← {project.data?.name}</Link> : null}<span className="eyebrow">Execution operations</span><h1>Task center</h1><p>Monitor persistent analysis jobs, worker progress and recoverable failures.</p></div><button className="button button--quiet" onClick={() => void tasks.refetch()}>Refresh</button></header>
      <section className="task-summary"><article><span>Total in view</span><strong>{tasks.data.total}</strong></article><article><span>Active</span><strong>{activeCount}</strong></article><article><span>Failed</span><strong>{failedCount}</strong></article><article><span>Worker polling</span><strong>{activeCount ? "Live" : "Idle"}</strong></article></section>
      <nav className="status-tabs" aria-label="Task status"><button className={!status ? "is-active" : ""} onClick={() => setStatus()}>All</button>{statuses.map((item) => <button className={status === item ? "is-active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}</nav>
      <section className="panel">
        {tasks.data.items.length === 0 ? <div className="empty-state"><div className="empty-icon" aria-hidden="true">↻</div><h3>No tasks found</h3><p>Submit a FIRRIS analysis or change the status filter.</p></div> : <div className="table-wrap"><table><thead><tr><th>Status</th><th>Task</th><th>Engine</th><th>Progress</th><th>Duration</th><th>Created</th></tr></thead><tbody>{tasks.data.items.map((task) => { const start = task.started_at ?? task.created_at; const end = task.completed_at ?? new Date().toISOString(); const duration = Math.max(0, new Date(end).getTime() - new Date(start).getTime()); return <tr key={task.id}><td><TaskStatusBadge status={task.status} /></td><td><Link className="table-link" to={`/tasks/${task.task_id}`}><strong>{task.task_type.replaceAll("_", " ")}</strong></Link><span>{task.task_id}</span></td><td><span className="engine-key">{task.engine_key}</span></td><td><div className="progress-cell"><progress max={100} value={Math.min(100, Math.max(0, task.progress_pct))}>{task.progress_pct}%</progress><small>{task.progress_pct}%</small></div></td><td>{duration < 60_000 ? `${Math.round(duration / 1000)}s` : `${Math.round(duration / 60_000)}m`}</td><td>{formatDate(task.created_at)}</td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  );
}
