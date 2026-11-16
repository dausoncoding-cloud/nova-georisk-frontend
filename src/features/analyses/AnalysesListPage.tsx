import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { FRRIS_ROUTES } from "../../app/routes";
import { queryKeys } from "../../shared/api/queryKeys";
import { ErrorState } from "../../shared/ui/ErrorState";
import { Icon } from "../../shared/ui/Icon";
import { LoadingState } from "../../shared/ui/LoadingState";
import { Pagination } from "../../shared/ui/Pagination";
import { FRRIS_ENGINE_KEY } from "../../shared/productName";
import { fetchProjectAois } from "../aois/aoisApi";
import { fetchProjects } from "../projects/projectsApi";
import { fetchResults } from "../results/resultsApi";
import { fetchTasks, type TaskFilters, type TaskStatus } from "../tasks/tasksApi";
import { buildRows, formatAreaValue, formatCreated, latestResult, matchesSearch, STATUS_FILTERS, type AnalysisRow } from "./analysesView";

const PAGE_SIZE = 50;
const NEW_ANALYSIS = FRRIS_ROUTES.newAnalysis;

function StatusPill({ status }: { status: AnalysisRow["status"] }) {
  return <span className={`fr-pill fr-pill--${status.tone} fr-status`}><span className="fr-status__dot" aria-hidden="true" />{status.label}</span>;
}

function EmptyState() {
  return (
    <section className="fr-empty" aria-labelledby="analyses-empty-title">
      <span className="fr-empty__icon" aria-hidden="true"><Icon name="flood" width={28} height={28} strokeWidth={2} /></span>
      <h2 id="analyses-empty-title">No analyses yet</h2>
      <p>Start your first flood analysis by drawing or uploading an area and choosing a baseline and a target period.</p>
      <Link className="fr-button fr-button--primary" to={NEW_ANALYSIS}>New analysis</Link>
    </section>
  );
}

export function AnalysesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const searchId = useId();
  // Mobile: the status filters are one scrollable row; the edge fade shows on the side(s) with more filters.
  const filterRow = useRef<HTMLDivElement>(null);
  const [filterFade, setFilterFade] = useState<"none" | "start" | "end" | "both">("none");
  const updateFilterFade = useCallback(() => {
    const row = filterRow.current;
    if (!row) return;
    const more = { start: row.scrollLeft > 1, end: row.scrollLeft + row.clientWidth < row.scrollWidth - 1 };
    setFilterFade(more.start && more.end ? "both" : more.start ? "start" : more.end ? "end" : "none");
  }, []);
  useEffect(() => {
    updateFilterFade();
    window.addEventListener("resize", updateFilterFade);
    return () => window.removeEventListener("resize", updateFilterFade);
  });
  const requestedStatus = searchParams.get("status");
  const status = STATUS_FILTERS.find((item) => item.value && item.value === requestedStatus)?.value;
  const requestedOffset = Number(searchParams.get("offset") ?? 0);
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
  const filters: TaskFilters = { status, limit: PAGE_SIZE, offset };

  const tasks = useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: () => fetchTasks(filters),
    placeholderData: keepPreviousData, // keep the list on screen while another filter or page loads
    refetchInterval: (query) => query.state.data?.items.some((task) => task.status === "queued" || task.status === "running") ? 5_000 : false,
  });
  const resultFilters = { engine_key: FRRIS_ENGINE_KEY, limit: PAGE_SIZE };
  const results = useQuery({ queryKey: queryKeys.results.list(resultFilters), queryFn: () => fetchResults(resultFilters) });
  const projects = useQuery({ queryKey: queryKeys.projects.all, queryFn: fetchProjects });
  const latest = useMemo(() => latestResult(results.data?.items ?? []), [results.data]);

  // AOI names and areas: one AOI list per project that appears on this page (or in the latest result).
  const projectIds = useMemo(() => [...new Set([...(tasks.data?.items.map((task) => task.project_id) ?? []), ...(latest ? [latest.projectId] : [])])].sort(), [tasks.data, latest]);
  const aoiQueries = useQueries({ queries: projectIds.map((projectId) => ({ queryKey: queryKeys.aois.project(projectId), queryFn: () => fetchProjectAois(projectId), staleTime: 60_000 })) });
  const aois = useMemo(() => new Map(aoiQueries.flatMap((query) => query.data?.items ?? []).map((aoi) => [aoi.id, aoi])), [aoiQueries]);
  const projectNames = useMemo(() => new Map((projects.data ?? []).map((project) => [project.id, project.name])), [projects.data]);
  const resultsById = useMemo(() => new Map((results.data?.items ?? []).map((result) => [result.id, result])), [results.data]);
  const rows = useMemo(() => buildRows(tasks.data?.items ?? [], aois, projectNames, resultsById), [tasks.data, aois, projectNames, resultsById]);
  const visibleRows = rows.filter((row) => matchesSearch(row, search));

  if (tasks.isPending) return <LoadingState label="Loading analyses…" />;
  if (tasks.isError) return <ErrorState title="Analyses could not be loaded" error={tasks.error} onRetry={() => void tasks.refetch()} />;

  const setStatus = (next?: TaskStatus) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("status", next); else params.delete("status");
    params.delete("offset");
    setSearchParams(params);
  };
  // Only fresh data decides the empty state; kept-over data from another filter must not flash it.
  const noAnalysesAtAll = !tasks.isPlaceholderData && tasks.data.total === 0 && !status && offset === 0;
  const latestName = latest?.aoiId ? aois.get(latest.aoiId)?.name ?? null : null;
  const lookupFailed = projects.isError || results.isError || aoiQueries.some((query) => query.isError);

  return (
    <div className="fr-page">
      <header className="fr-page-header">
        <div className="fr-page-header__text">
          <h1>Analyses</h1>
          <p>Flood-candidate analyses for your organization.</p>
        </div>
        <div className="fr-page-header__actions">
          <button type="button" className="fr-button fr-button--secondary" onClick={() => { void tasks.refetch(); void results.refetch(); }} disabled={tasks.isFetching}>Refresh</button>
          <Link className="fr-button fr-button--primary" to={NEW_ANALYSIS}><Icon name="plus" width={16} height={16} strokeWidth={2.4} />New analysis</Link>
        </div>
      </header>

      {noAnalysesAtAll ? <EmptyState /> : <>
        {latest ? (
          <section className="fr-card fr-latest" aria-labelledby="latest-result-title">
            <div className="fr-latest__intro">
              <span className="fr-overline" id="latest-result-title">Latest completed</span>
              <Link className="fr-latest__name" to={`/results/${latest.resultId}`}>{latestName ?? "Open the latest result"}</Link>
              {latest.targetPeriod ? <span className="fr-latest__meta">Target period {latest.targetPeriod}</span> : null}
              {latest.basis ? <span className="fr-latest__meta">{latest.basis}</span> : null}
              {latest.independentNote ? <span className="fr-latest__note">{latest.independentNote}</span> : null}
            </div>
            {latest.metrics.length ? (
              <dl className="fr-latest__metrics">
                {latest.metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd className="fr-num">{metric.value}</dd></div>)}
              </dl>
            ) : null}
          </section>
        ) : null}

        <section className="fr-card fr-analyses" aria-label="All analyses">
          <div className="fr-analyses__toolbar">
            <label className="fr-search" htmlFor={searchId}>
              <span className="fr-visually-hidden">Search analyses on this page</span>
              <Icon name="search" width={16} height={16} />
              <input id={searchId} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or project" />
            </label>
            <div className="fr-filters-scroll" data-fade={filterFade}>
              <div role="group" aria-label="Filter by status" className="fr-filters" ref={filterRow} onScroll={updateFilterFade}>
                {STATUS_FILTERS.map((filter) => (
                  <button key={filter.label} type="button" className="fr-filter" aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>{filter.label}</button>
                ))}
              </div>
            </div>
          </div>
          {lookupFailed ? <p className="fr-analyses__notice" role="status">Some names, areas or periods could not be loaded; they are shown as “—”.</p> : null}
          {search ? <p className="fr-visually-hidden" role="status">{visibleRows.length} of {rows.length} analyses on this page match.</p> : null}
          {visibleRows.length === 0 ? (
            <div className="fr-analyses__none">
              <p>{search ? "No analyses on this page match your search." : "No analyses with this status."}</p>
              {search ? <button type="button" className="fr-button fr-button--secondary" onClick={() => setSearch("")}>Clear search</button>
                : <button type="button" className="fr-button fr-button--secondary" onClick={() => setStatus()}>Show all analyses</button>}
            </div>
          ) : (
            <div className="fr-table-wrap">
              <table className="fr-table">
                <thead><tr><th scope="col">Analysis</th><th scope="col">Target period</th><th scope="col">Area</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Analysis" className="fr-table__name"><div>
                        <Link to={row.href}>{row.name ?? `Analysis ${row.taskId.slice(0, 8)}`}</Link>
                        {row.projectName ? <span>{row.projectName}</span> : null}
                        {row.attention ? <span className="fr-table__attention">{row.attention}</span> : null}
                      </div></td>
                      <td data-label="Target period">{row.targetPeriod ?? <Missing />}</td>
                      <td data-label="Area">{row.areaKm2 === null ? <Missing /> : <span className="fr-nowrap"><span className="fr-num">{formatAreaValue(row.areaKm2)}</span> km²</span>}</td>
                      <td data-label="Status"><StatusPill status={row.status} /></td>
                      <td data-label="Created">{formatCreated(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination offset={offset} limit={PAGE_SIZE} total={tasks.data.total} busy={tasks.isFetching}
            onChange={(next) => { const params = new URLSearchParams(searchParams); params.set("offset", String(next)); setSearchParams(params); }} />
        </section>
      </>}
    </div>
  );
}

function Missing() {
  return <><span aria-hidden="true">—</span><span className="fr-visually-hidden">Not available</span></>;
}
