import type { components } from "../../shared/api/generated/nova-browser-api";

type Analytics = components["schemas"]["ResultAnalytics"];
export function deliveredValue(value: unknown): string {
  if (value === null || value === undefined) return "Unavailable / not applicable (not supplied)";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function DeliveredMetadata({ value }: { value: Record<string, unknown> | null | undefined }) {
  return value && Object.keys(value).length ? <dl className="metadata-list">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{item && typeof item === "object" && !Array.isArray(item) ? <DeliveredMetadata value={item as Record<string, unknown>} /> : deliveredValue(item)}</dd></div>)}</dl> : <p>Unavailable / not applicable (not supplied)</p>;
}
function StatisticalSummary({ product, value }: { product: string; value: unknown }) {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : { value };
  const units = typeof record.units === "string" ? record.units : "Unavailable (not supplied)";
  function rows(data: Record<string, unknown>, prefix = ""): Array<{ metric: string; value: unknown; units: string }> {
    return Object.entries(data).flatMap(([key, item]) => {
      const metric = prefix + key;
      if (item && typeof item === "object" && !Array.isArray(item)) return rows(item as Record<string, unknown>, metric + ".");
      const explicitUnit = key.endsWith("_m2") ? "m²" : key.endsWith("_ha") ? "ha" : key.endsWith("_km2") ? "km²" : key.includes("percent") || key.endsWith("_pct") ? "%" : key === "cells" || key.endsWith("_cells") ? "cells" : ["min", "max", "mean", "minimum", "maximum", "median", "std"].includes(key) ? units : "Unavailable (not supplied)";
      return [{ metric, value: item, units: typeof item === "number" ? explicitUnit : "Not applicable" }];
    });
  }
  return <div className="quantitative-table"><table><caption>{product}: backend-delivered statistical summary</caption><thead><tr><th>Metric</th><th>Delivered value</th><th>Units</th></tr></thead><tbody>{rows(record).map(row => <tr key={row.metric}><td>{row.metric}</td><td>{deliveredValue(row.value)}</td><td>{row.units}</td></tr>)}</tbody></table></div>;
}
function SeriesView({ series }: { series: components["schemas"]["QuantitativeSeries"] }) {
  const points = series.points as Record<string, unknown>[];
  const histogram = series.kind === "histogram";
  const fields = histogram ? ["lower", "upper", "count"] : series.kind === "observed_time_series" ? ["timestamp", "value"] : ["label", "value"];
  const values = points.map(point => point[histogram ? "count" : "value"]);
  const valid = values.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0);
  const maximum = valid ? Math.max(0, ...values as number[]) : 0;
  return <article><h3>{series.product_key} · {series.kind.replaceAll("_", " ")}</h3><p>Units: {series.units}; {histogram ? "bar height: cells" : "bar height: " + series.units}</p><p>{series.basis}</p>{points.length && valid ? <svg role="img" aria-label={`${series.product_key} ${series.kind} chart`} viewBox={`0 0 ${Math.max(1, points.length) * 50} 120`} style={{ width: "100%", maxHeight: 180 }}>{points.map((point, index) => { const height = maximum === 0 ? 0 : (values[index] as number) / maximum * 100; return <g key={index}><title>{fields.map(field => `${field}: ${deliveredValue(point[field])}`).join("; ")}</title><rect x={index * 50 + 5} y={110 - height} width={40} height={height} fill="#007d8e" /><text x={index * 50 + 25} y={119} textAnchor="middle" fontSize={8}>{index + 1}</text></g>; })}</svg> : <p>Chart unavailable: no finite nonnegative delivered points.</p>}<div className="quantitative-table"><table><caption>Delivered points ({series.units}); chart indices follow row order</caption><thead><tr>{fields.map(field => <th key={field}>{field === "value" ? `Value (${series.units})` : field === "count" ? "Count (cells)" : field.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{points.map((point, index) => <tr key={index}>{fields.map(field => <td key={field}>{deliveredValue(point[field])}</td>)}</tr>)}</tbody></table></div><p>Evidence: {series.evidence_refs.join(", ")}</p></article>;
}
export function QuantitativeDelivery({ analytics, products, change }: { analytics: Analytics | null | undefined; products?: Record<string, unknown> | null; change?: Record<string, unknown> | null }) {
  const rows = analytics?.class_areas ?? [];
  const columns = ["product_key", "class_value", "label", "cells", "area_m2", "area_ha", "area_km2", "percent_of_valid", "denominator_area_m2", "area_method", "classification_basis", "evidence_ref"] as const;
  const labels = ["Product", "Class code", "Class", "Cells", "Area (m²)", "Area (ha)", "Area (km²)", "% of valid area", "Valid-area denominator (m²)", "Area method", "Classification basis", "Evidence"];
  return <section className="panel"><h2>Quantitative analytics</h2>{rows.length ? <div className="quantitative-table"><table><caption>Backend-delivered class areas, including zero-cell classes</caption><thead><tr>{labels.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(key => <td key={key}>{deliveredValue(row[key])}</td>)}</tr>)}</tbody></table></div> : <p>Class areas unavailable / not applicable: no class-area evidence supplied.</p>}<h3>Product area and statistical summaries</h3>{products && Object.keys(products).length ? Object.entries(products).map(([key, value]) => <StatisticalSummary key={key} product={key} value={value} />) : <p>Statistical summaries unavailable / not applicable.</p>}{change ? <><h3>Delivered change statistics</h3><DeliveredMetadata value={change} /></> : null}{analytics?.series?.length ? analytics.series.map((series, index) => <SeriesView key={index} series={series} />) : <p>Charts and observed time series unavailable / not applicable: no quantitative series supplied.</p>}{analytics?.limitations.map((text, index) => <p key={index}>{text}</p>)}</section>;
}
