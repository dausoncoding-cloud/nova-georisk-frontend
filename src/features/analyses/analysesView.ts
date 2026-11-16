// View model for the FRRIS Analyses list. Everything shown comes from the API:
// tasks (status, progress, error summary, dates), the project AOI lists (name, area) and the result list
// (target period, accuracy). Missing data is shown as missing, never invented.
import type { components } from "../../shared/api/generated/nova-browser-api";
import type { TaskStatus, TaskStatusResponse } from "../tasks/tasksApi";

type Result = components["schemas"]["ResultResponse"];
type Scope = components["schemas"]["AccuracyScope"];
type Aoi = Pick<components["schemas"]["AOIResponse"], "id" | "name"> & { stats?: { area_km2?: number | null } | null };

export type StatusTone = "success" | "info" | "neutral" | "warning";

// Filters keep the API status values in the URL (?status=), so old /tasks?status=… links keep working.
export const STATUS_FILTERS: readonly { value?: TaskStatus; label: string }[] = [
  { label: "All" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Needs attention" },
  { value: "canceled", label: "Canceled" },
];

export function statusPresentation(task: Pick<TaskStatusResponse, "status" | "progress_pct">): { label: string; tone: StatusTone } {
  switch (task.status) {
    case "completed": return { label: "Completed", tone: "success" };
    case "running": return { label: `Running · ${clampPct(task.progress_pct)}%`, tone: "info" };
    case "queued": return { label: "Queued", tone: "info" };
    case "failed": return { label: "Needs attention", tone: "warning" };
    case "canceled": return { label: "Canceled", tone: "neutral" };
    default: return { label: String(task.status), tone: "neutral" };
  }
}

const clampPct = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export type AnalysisRow = {
  id: string;
  taskId: string;
  name: string | null;        // AOI name
  projectName: string | null;
  href: string;               // result for completed runs with a result, otherwise the task
  targetPeriod: string | null;
  areaKm2: number | null;
  status: { label: string; tone: StatusTone };
  attention: string | null;   // error summary of a failed run
  createdAt: string;
};

export function buildRows(
  tasks: readonly TaskStatusResponse[],
  aois: ReadonlyMap<string, Aoi>,
  projects: ReadonlyMap<string, string>,
  results: ReadonlyMap<string, Result>,
): AnalysisRow[] {
  return tasks.map((task) => {
    const aoi = task.aoi_id ? aois.get(task.aoi_id) : undefined;
    const resultId = task.status === "completed" ? task.result_reference?.id : undefined;
    const result = resultId ? results.get(resultId) : undefined;
    return {
      id: task.id,
      taskId: task.task_id,
      name: aoi?.name ?? null,
      projectName: projects.get(task.project_id) ?? null,
      href: resultId ? `/results/${resultId}` : `/tasks/${task.task_id}`,
      targetPeriod: result?.overview?.headline.target_period ?? null,
      areaKm2: aoi?.stats?.area_km2 ?? null,
      status: statusPresentation(task),
      attention: task.status === "failed" ? (task.error_summary || null) : null,
      createdAt: task.created_at,
    };
  });
}

export function matchesSearch(row: AnalysisRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.name, row.projectName, row.targetPeriod, row.taskId].some((value) => value?.toLowerCase().includes(needle));
}

export type LatestResult = {
  resultId: string;
  aoiId: string | null;
  projectId: string;
  targetPeriod: string | null;
  basis: string | null;        // scope title from the API, e.g. the independent Sentinel-2 reference
  independent: boolean;
  independentNote: string | null;
  metrics: { label: string; value: string }[];
};

const fixed = (value: number | null | undefined, digits: number) => (value === null || value === undefined || !Number.isFinite(value) ? null : value.toFixed(digits));

// Latest result: the newest result (the API lists newest first). Metrics come from the independent optical scope
// when it was assessed, otherwise from the first scope reported, labelled with that scope's own title.
export function latestResult(results: readonly Result[]): LatestResult | null {
  const result = results[0];
  if (!result) return null;
  const assessment = result.validation_dashboard?.accuracy_assessment ?? null;
  const independent = assessment?.independent_status === "assessed";
  const scope: Scope | undefined = assessment
    ? (independent ? assessment.scopes.find((item) => item.scope === "independent_optical") : undefined) ?? assessment.scopes[0]
    : undefined;
  const metrics = scope ? [
    { label: "Overall accuracy", value: fixed(scope.overall_accuracy_pct, 1), suffix: "%" },
    { label: "Kappa", value: fixed(scope.cohens_kappa, 3), suffix: "" },
    { label: "F1 (flood candidate)", value: fixed(scope.f1_flooded, 3), suffix: "" },
    { label: "AUC", value: fixed(scope.roc_auc, 3), suffix: "" },
  ].flatMap((metric) => metric.value === null ? [] : [{ label: metric.label, value: `${metric.value}${metric.suffix}` }]) : [];
  return {
    resultId: result.id,
    aoiId: result.aoi_id ?? null,
    projectId: result.project_id,
    targetPeriod: result.overview?.headline.target_period ?? null,
    basis: scope?.title ?? null,
    independent,
    independentNote: assessment && !independent
      ? `Independent accuracy: ${INDEPENDENT_STATUS[assessment.independent_status] ?? assessment.independent_status.replaceAll("_", " ")}.`
      : null,
    metrics,
  };
}

const INDEPENDENT_STATUS: Record<string, string> = {
  not_assessable: "not assessable",
  insufficient_reference_samples: "insufficient reference samples",
  not_performed: "not performed",
};

const AREA = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const formatAreaValue = (km2: number) => AREA.format(km2);
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const formatCreated = (iso: string) => DATE.format(new Date(iso));
