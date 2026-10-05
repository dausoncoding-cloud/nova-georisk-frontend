import { protectedProductUrl } from "./resultsApi";
import { groupResultExports } from "./exportGroups";
import type { ResultArtifact } from "./gisViewer";

function formatBytes(value: number | null | undefined) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportCenter({ resultId, artifacts }: { resultId: string; artifacts: ResultArtifact[] }) {
  const groups = groupResultExports(artifacts);
  return <section className="panel export-center"><div className="panel-heading"><div><h2>Export center</h2><p>Authorized downloads for reports, tables, GIS products, and the complete package.</p></div><span className="count-badge">{artifacts.length}</span></div>{groups.length === 0 ? <div className="empty-state"><h3>No exports available</h3><p>This result does not contain downloadable artifacts.</p></div> : <div className="export-groups">{groups.map((group) => <section key={group.key} className="export-group"><header><h3>{group.label}</h3><p>{group.description}</p></header><div>{group.artifacts.map((artifact) => <article className="export-row" key={artifact.key}><div><strong>{artifact.label}</strong><span>{artifact.format.toUpperCase()} · {formatBytes(artifact.file_size_bytes)} · v{artifact.result_version}</span></div><a className="button button--secondary" href={protectedProductUrl(resultId, artifact.key)}>Download</a></article>)}</div></section>)}</div>}</section>;
}
