import { useState } from "react";
import { protectedProductUrl } from "./resultsApi";
import { groupResultExports } from "./exportGroups";
import { Pagination } from "../../shared/ui/Pagination";
import type { ResultArtifact } from "./gisViewer";

function formatBytes(value: number | null | undefined) {
  if (value == null) return "Not supplied";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
const columns = [{ key: "label", label: "Artifact" }, { key: "artifact_type", label: "Type" }, { key: "format", label: "Format" }, { key: "file_size_bytes", label: "Size" }] as const;
type SortKey = typeof columns[number]["key"];

export function ExportCenter({ resultId, artifacts, createdAt }: { resultId: string; artifacts: ResultArtifact[]; createdAt?: string }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState<SortKey>("label");
  const [descending, setDescending] = useState(false);
  const [offset, setOffset] = useState(0);
  const groups = groupResultExports(artifacts);
  const filtered = (group ? groups.find(item => item.key === group)?.artifacts ?? [] : artifacts)
    .filter(item => `${item.label} ${item.key} ${item.format} ${item.artifact_type}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice().sort((a, b) => {
      const left = a[sort]; const right = b[sort];
      // Unknown sizes always follow known values.
      if (left == null) return right == null ? 0 : 1;
      if (right == null) return -1;
      return (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))) * (descending ? -1 : 1);
    });
  const pageOffset = Math.min(offset, Math.max(0, Math.ceil(filtered.length / 20) - 1) * 20);
  return <section className="panel export-center"><div className="panel-heading"><h2>Data & Files</h2><span className="count-badge">{artifacts.length}</span></div>
    <div className="table-tools"><label className="field"><span>Search artifacts</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setOffset(0); }} placeholder="Name, type or format" /></label><label className="field"><span>Category</span><select value={group} onChange={event => { setGroup(event.target.value); setOffset(0); }}><option value="">All files</option>{groups.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="field artifact-sort"><span>Sort files</span><select value={`${sort}:${descending ? "desc" : "asc"}`} onChange={event => { const [key, direction] = event.target.value.split(":"); setSort(key as SortKey); setDescending(direction === "desc"); setOffset(0); }}>{columns.flatMap(column => [<option key={`${column.key}:asc`} value={`${column.key}:asc`}>{column.label} · ascending</option>, <option key={`${column.key}:desc`} value={`${column.key}:desc`}>{column.label} · descending</option>])}</select></label><span role="status">{filtered.length} files</span></div>
    {filtered.length ? <div className="table-wrap"><table className="responsive-table"><caption className="sr-only">Downloadable result artifacts</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort === column.key ? descending ? "descending" : "ascending" : "none"}><button className="sort-button" onClick={() => { setSort(column.key); setDescending(sort === column.key ? !descending : false); setOffset(0); }}>{column.label}{sort === column.key ? descending ? " ↓" : " ↑" : ""}</button></th>)}<th scope="col">Generated</th><th scope="col">Action</th></tr></thead><tbody>{filtered.slice(pageOffset, pageOffset + 20).map(artifact => <tr key={artifact.key}><td data-label="Artifact"><strong>{artifact.label}</strong><span>v{artifact.result_version} · {artifact.key}</span></td><td data-label="Type">{artifact.artifact_type}</td><td data-label="Format">{artifact.format.toUpperCase()}</td><td data-label="Size">{formatBytes(artifact.file_size_bytes)}</td><td data-label="Generated">{createdAt ? <><time dateTime={createdAt}>{new Date(createdAt).toLocaleDateString()}</time><small className="cell-note">Result date</small></> : "Not supplied"}</td><td data-label="Action"><a className="button button--secondary button--small" aria-label={`Download ${artifact.label}`} href={protectedProductUrl(resultId, artifact.key)}>Download</a></td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>{artifacts.length ? "No matching files" : "No exports available"}</h3><p>{artifacts.length ? "Try another search or category." : "No downloadable artifacts were supplied."}</p>{artifacts.length ? <button className="button button--quiet" onClick={() => { setQuery(""); setGroup(""); setOffset(0); }}>Clear filters</button> : null}</div>}
    <Pagination offset={pageOffset} limit={20} total={filtered.length} onChange={setOffset} />
  </section>;
}
