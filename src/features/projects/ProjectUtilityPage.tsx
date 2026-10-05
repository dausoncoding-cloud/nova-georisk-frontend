import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { queryKeys } from "../../shared/api/queryKeys";
import { fetchResults } from "../results/resultsApi";

export function ProjectUtilityPage({ mode }: { mode: "map" | "reports" | "exports" }) {
  const { projectId = "" } = useParams();
  const results = useQuery({ queryKey: queryKeys.results.list({ project_id: projectId }), queryFn: () => fetchResults({ project_id: projectId, limit: 100 }), enabled: Boolean(projectId) });
  const labels = { map: ["Map workspace", "Open a completed result to explore protected raster and vector layers."], reports: ["Reports", "Review analysis reports and provenance packages."], exports: ["Export center", "Download available PDF, tabular and GIS artifacts."] } as const;
  return <div className="page-stack"><header className="section-heading"><div><span className="eyebrow">FIRRIS products</span><h2>{labels[mode][0]}</h2><p>{labels[mode][1]}</p></div></header><div className="result-tile-grid">{results.data?.items.map((result) => <article className="result-tile" key={result.id}><div><span className="engine-pill">FIRRIS · v{result.version}</span><h3>{result.result_type.replaceAll("_", " ")}</h3><p>{new Date(result.created_at).toLocaleString()} · {result.products.length} products</p></div><Link className="button button--secondary" to={`/results/${result.id}`}>{mode === "map" ? "Open map" : mode === "reports" ? "View reports" : "Open exports"}</Link></article>)}{results.data?.items.length === 0 ? <div className="panel empty-state"><h3>No completed results</h3><p>Run a FIRRIS analysis to populate this workspace.</p><Link className="button button--primary" to={`/projects/${projectId}/analysis`}>New analysis</Link></div> : null}</div></div>;
}
