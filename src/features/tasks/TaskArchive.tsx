import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, getErrorMessage } from "../../shared/api/errors";
import { DeliveredMetadata, deliveredValue } from "../results/QuantitativeDelivery";
import { archiveFilename, downloadArchive, fetchTaskArchive } from "./taskArchive";

export function TaskArchive({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["tasks", taskId, "archive"], queryFn: () => fetchTaskArchive(taskId), enabled: open, retry: false, staleTime: 0 });
  const archive = query.data?.archive;
  const execution = archive?.task.execution;
  return <section className="panel"><h2>Execution archive</h2><button type="button" className="button button--secondary" disabled={query.isFetching} onClick={() => { setOpen(true); if (open) void query.refetch(); }}>{query.isFetching ? "Loading archive…" : open ? "Refresh archive" : "Open execution archive"}</button>{query.isError ? <p role="alert">{query.error instanceof ApiError && [401, 403].includes(query.error.status) ? "You are not authorized to access this task archive. " : "Archive unavailable. "}{getErrorMessage(query.error)}</p> : null}{open && archive && !query.isError ? <><button type="button" className="button button--secondary" disabled={query.isFetching} onClick={() => { try { downloadArchive(archive, archiveFilename(query.data?.disposition ?? null, taskId)); setDownloadError(null); } catch (error) { setDownloadError(getErrorMessage(error)); } }}>Download execution archive (JSON)</button>{downloadError ? <p role="alert">{downloadError}</p> : null}<h3>Submitted parameters (backend redacted)</h3><DeliveredMetadata value={archive.submitted_parameters} /><h3>Result versions</h3>{archive.results.length ? archive.results.map((result, index) => <DeliveredMetadata key={index} value={result} />) : <p>No archived result versions supplied.</p>}<h3>Execution provenance and consistency hashes</h3><DeliveredMetadata value={execution ? Object.fromEntries(Object.entries(execution).filter(([key]) => key !== "events")) : null} /><h3>Observed audit events</h3>{execution?.events.length ? <div className="quantitative-table"><table><thead><tr>{Object.keys(execution.events[0]!).map(key => <th key={key}>{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{execution.events.map((event, index) => <tr key={index}>{Object.keys(execution.events[0]!).map(key => <td key={key}>{deliveredValue((event as unknown as Record<string, unknown>)[key])}</td>)}</tr>)}</tbody></table></div> : <p>Historical audit events unavailable; no history supplied.</p>}{archive.limitations.map((text, index) => <p key={index}>{text}</p>)}</> : null}</section>;
}
