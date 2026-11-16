import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FRRIS_ROUTES } from "../../app/routes";
import { getErrorMessage } from "../../shared/api/errors";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { Icon } from "../../shared/ui/Icon";
import { LoadingState } from "../../shared/ui/LoadingState";
import { fetchAoi } from "../aois/aoisApi";
import { statusPresentation } from "../analyses/analysesView";
import { TaskArchive } from "./TaskArchive";
import { fetchTaskArchive } from "./taskArchive";
import { cancelTask, fetchTask, retryTask, taskPollingInterval } from "./tasksApi";
import { explainFailure, formatTime, RUN_STEPS, submittedPeriods, timeline } from "./taskView";

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const task = useQuery({ queryKey: queryKeys.tasks.detail(taskId), queryFn: () => fetchTask(taskId), enabled: Boolean(taskId), refetchInterval: (query) => taskPollingInterval(query.state.data) });
  const aoiId = task.data?.aoi_id ?? "";
  const aoi = useQuery({ queryKey: queryKeys.aois.detail(aoiId), queryFn: () => fetchAoi(aoiId), enabled: Boolean(aoiId), retry: false });
  // The submitted windows are in the task archive; when the role cannot read it, the header simply omits the dates.
  const archive = useQuery({ queryKey: ["tasks", taskId, "archive"], queryFn: () => fetchTaskArchive(taskId), enabled: Boolean(taskId), retry: false, staleTime: 60_000 });
  const action = useMutation({
    mutationFn: (kind: "cancel" | "retry") => kind === "cancel" ? cancelTask(taskId) : retryTask(taskId),
    onSuccess: (updated, kind) => {
      queryClient.setQueryData(queryKeys.tasks.detail(updated.task_id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      if (kind === "retry" && updated.task_id !== taskId) navigate(`/tasks/${updated.task_id}`, { replace: true });
    },
  });

  if (task.isPending) return <LoadingState label="Loading the analysis…" />;
  if (task.isError) return <ErrorState title="Analysis could not be loaded" error={task.error} onRetry={() => void task.refetch()} subject="analysis" />;
  const data = task.data;
  const active = data.status === "queued" || data.status === "running";
  const status = statusPresentation(data);
  const periods = submittedPeriods(archive.data?.archive.submitted_parameters);
  const meta = [periods.target ? `Target ${periods.target}` : null, periods.baseline ? `Baseline ${periods.baseline}` : null].filter(Boolean);
  const events = timeline(data.execution?.events);
  const progress = Math.min(100, Math.max(0, Math.round(data.progress_pct)));
  const failure = data.status === "failed" ? explainFailure(data.error_summary) : null;
  const editHref = `${FRRIS_ROUTES.newAnalysis}?project=${encodeURIComponent(data.project_id)}${data.aoi_id ? `&aoi_id=${encodeURIComponent(data.aoi_id)}` : ""}`;
  const actionError = action.isError ? <p className="fr-box fr-box--danger" role="alert">{getErrorMessage(action.error)}</p> : null;

  return <div className="fr-run">
    <header className="fr-result__header">
      <Link className="fr-back" to={FRRIS_ROUTES.analyses}>← Analyses</Link>
      <div className="fr-result__title">
        <div>
          <span className="fr-overline">Analysis</span>
          <h1>{aoi.data?.name ?? `Analysis ${data.task_id.slice(0, 8)}`}</h1>
        </div>
        <span className={`fr-pill fr-pill--${status.tone} fr-status`}><span className="fr-status__dot" aria-hidden="true" />{status.label}</span>
      </div>
      {meta.length ? <p className="fr-result__meta">{meta.join(" · ")}</p> : null}
    </header>

    {active ? <>
      <section className="fr-card fr-section" aria-labelledby="run-progress">
        <div className="fr-section__head">
          <h2 id="run-progress">{data.status === "queued" ? "Waiting to start" : "Running"}</h2>
          <span className="fr-help">{data.started_at ? `Started ${formatTime(data.started_at)}` : `Submitted ${formatTime(data.created_at)}`}</span>
        </div>
        <div className="fr-progress">
          <div className="fr-progress__label"><span>Progress</span><strong className="fr-num">{progress}%</strong></div>
          <div className="fr-progress__track" role="progressbar" aria-label="Analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}%`}>
            <div className="fr-progress__bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <h3 className="fr-run__steps-title">What the analysis does</h3>
        <ol className="fr-run__steps">{RUN_STEPS.map(([title, detail]) => <li key={title}><strong>{title}</strong><span>{detail}</span></li>)}</ol>
        <p className="fr-help">This page refreshes automatically. Progress is reported as a percentage of the whole run.</p>
      </section>
      <p className="fr-box fr-box--info" role="note">You can leave this page. The analysis keeps running and will appear under Analyses when it is ready.</p>
      <div className="fr-run__actions">
        <button type="button" className="fr-button fr-button--secondary fr-button--danger" disabled={action.isPending} onClick={() => action.mutate("cancel")}>Cancel analysis</button>
      </div>
      {actionError}
    </> : null}

    {failure ? (
      <section className="fr-card fr-section fr-failure" role="alert" aria-labelledby="run-failure">
        <div className="fr-failure__head">
          <span className="fr-failure__icon" aria-hidden="true"><Icon name="warning" width={22} height={22} strokeWidth={2} /></span>
          <div>
            <h2 id="run-failure">{failure.title}</h2>
            {failure.detail ? <p>{failure.detail}</p> : null}
            {data.error_summary ? <p className="fr-failure__message">{data.error_summary}</p> : null}
          </div>
        </div>
        <div className="fr-failure__hints"><strong>What you can do</strong><ul>{failure.hints.map((hint) => <li key={hint}>{hint}</li>)}</ul></div>
        <div className="fr-run__actions">
          <Link className="fr-button fr-button--primary" to={editHref}>Edit and retry</Link>
          <button type="button" className="fr-button fr-button--secondary" disabled={action.isPending} onClick={() => action.mutate("retry")}>Retry with the same settings</button>
          <Link className="fr-button fr-button--secondary" to={FRRIS_ROUTES.analyses}>Back to analyses</Link>
        </div>
        <p className="fr-failure__ref">Reference: <span className="fr-num">{data.task_id}</span>. Share this reference with support if you need help.{data.result_reference ? "" : " No result was saved."}</p>
      </section>
    ) : null}
    {failure ? actionError : null}

    {data.status === "canceled" ? (
      <section className="fr-card fr-section" aria-labelledby="run-canceled">
        <h2 id="run-canceled">Analysis canceled</h2>
        <p>The analysis was stopped before it finished.{data.result_reference ? "" : " No result was saved."}</p>
        <div className="fr-run__actions">
          <button type="button" className="fr-button fr-button--primary" disabled={action.isPending} onClick={() => action.mutate("retry")}>Run it again</button>
          <Link className="fr-button fr-button--secondary" to={editHref}>Edit and retry</Link>
        </div>
        {actionError}
        <p className="fr-help">Reference: <span className="fr-num">{data.task_id}</span></p>
      </section>
    ) : null}

    {data.status === "completed" ? (
      <section className="fr-card fr-section" aria-labelledby="run-done">
        <h2 id="run-done">Analysis completed</h2>
        <p>{data.completed_at ? `Finished ${formatTime(data.completed_at)}.` : "Finished."}</p>
        {data.result_reference ? <div className="fr-run__actions"><Link className="fr-button fr-button--primary" to={`/results/${data.result_reference.id}`}>Open result</Link></div> : null}
      </section>
    ) : null}

    {events.length ? (
      <section className="fr-card fr-section" aria-labelledby="run-timeline">
        <h2 id="run-timeline">{failure ? "Where it stopped" : "Run history"}</h2>
        <ol className="fr-timeline">
          {events.map((item) => <li key={item.key} className={`fr-timeline__item fr-timeline__item--${item.tone}`}>
            <span className="fr-timeline__mark" aria-hidden="true">{item.tone === "stop" ? "!" : item.tone === "done" ? <Icon name="check" width={14} height={14} strokeWidth={2.6} /> : null}</span>
            <span><strong>{item.label}{item.tone === "stop" && failure ? `: ${failure.title.toLowerCase()}` : ""}</strong><span>{formatTime(item.at)}</span></span>
          </li>)}
        </ol>
      </section>
    ) : null}

    <TaskArchive key={taskId} taskId={taskId} />
  </div>;
}
