import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { cancelTask, fetchTask, retryTask, taskPollingInterval } from "./tasksApi";
import { TaskStatusBadge } from "./TaskStatusBadge";

const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "—";

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const task = useQuery({ queryKey: queryKeys.tasks.detail(taskId), queryFn: () => fetchTask(taskId), enabled: Boolean(taskId), refetchInterval: (query) => taskPollingInterval(query.state.data) });
  const action = useMutation({
    mutationFn: (kind: "cancel" | "retry") => kind === "cancel" ? cancelTask(taskId) : retryTask(taskId),
    onSuccess: (updated, kind) => {
      queryClient.setQueryData(queryKeys.tasks.detail(updated.task_id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      if (kind === "retry" && updated.task_id !== taskId) navigate(`/tasks/${updated.task_id}`, { replace: true });
    },
  });

  if (task.isPending) return <LoadingState label="Loading task status…" />;
  if (task.isError) return <ErrorState title="Task could not be loaded" error={task.error} onRetry={() => void task.refetch()} />;
  const data = task.data;
  const isActive = data.status === "queued" || data.status === "running";

  return (
    <div className="page-stack">
      <header className="page-heading"><div><Link className="back-link" to={`/projects/${data.project_id}/tasks`}>← Project tasks</Link><span className="eyebrow">Task {data.task_id}</span><h1>{data.task_type.replaceAll("_", " ")}</h1><p>Worker state refreshes automatically while this task is queued or running.</p></div><TaskStatusBadge status={data.status} /></header>
      <section className="task-progress-card"><div className="task-progress-card__top"><div><span>Processing progress</span><strong>{data.progress_pct}%</strong></div><span>{isActive ? "Auto-refreshing every 2 seconds" : "Terminal state"}</span></div><progress className="progress-track" max={100} value={Math.min(100, Math.max(0, data.progress_pct))}>{data.progress_pct}%</progress></section>
      <section className="detail-grid"><article className="metric-card"><span>Engine</span><strong>{data.engine_key}</strong></article><article className="metric-card"><span>Created</span><strong>{formatDate(data.created_at)}</strong></article><article className="metric-card"><span>Started</span><strong>{formatDate(data.started_at)}</strong></article><article className="metric-card"><span>Completed</span><strong>{formatDate(data.completed_at)}</strong></article></section>
      {data.error_summary ? <section className="error-panel" role="alert"><span className="eyebrow">Analysis error</span><h2>Task did not complete</h2><p>{data.error_summary}</p></section> : null}
      <section className="panel action-panel"><div><h2>Task actions</h2><p>Cancel active work or retry a failed/canceled task through the protected BFF contract.</p></div><div className="form-actions">{isActive ? <button className="button button--danger" type="button" disabled={action.isPending} onClick={() => action.mutate("cancel")}>Cancel task</button> : null}{data.status === "failed" || data.status === "canceled" ? <button className="button button--primary" type="button" disabled={action.isPending} onClick={() => action.mutate("retry")}>Retry task</button> : null}{data.result_reference ? <Link className="button button--primary" to={`/results/${data.result_reference.id}`}>Open result</Link> : null}</div>{action.isError ? <div className="card-error" role="alert">{getErrorMessage(action.error)}</div> : null}</section>
    </div>
  );
}
