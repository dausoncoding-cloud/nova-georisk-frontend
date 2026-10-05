const datasets = [
  { name: "Sentinel-1 GRD", kind: "SAR", resolution: "10 m", use: "Flood extent and backscatter change", status: "Active" },
  { name: "Sentinel-2 SR", kind: "Optical", resolution: "10–20 m", use: "Cloud-masked spectral features", status: "Active" },
  { name: "CHIRPS Daily", kind: "Precipitation", resolution: "0.05°", use: "Rainfall accumulation", status: "Active" },
  { name: "SRTM / ALOS", kind: "Elevation", resolution: "30 m", use: "Terrain and hydrologic features", status: "Active" },
  { name: "JRC Global Surface Water", kind: "Water history", resolution: "30 m", use: "Permanent-water context", status: "Active" },
];

export function DataCatalogPage() {
  return <div className="page-stack"><header className="section-heading"><div><span className="eyebrow">Acquisition catalog</span><h2>FIRRIS data sources</h2><p>Datasets currently used by the server-side analysis pipeline. Availability is determined by Earth Engine at execution time.</p></div></header><div className="catalog-grid">{datasets.map((dataset) => <article className="catalog-card" key={dataset.name}><div className="catalog-card__top"><span className="data-kind">{dataset.kind}</span><span className="status-dot"><i />{dataset.status}</span></div><h3>{dataset.name}</h3><p>{dataset.use}</p><dl><div><dt>Nominal resolution</dt><dd>{dataset.resolution}</dd></div><div><dt>Access</dt><dd>Server-side GEE</dd></div></dl></article>)}</div><div className="notice">Dataset IDs and date filters are recorded in result provenance. The browser never receives Earth Engine credentials.</div></div>;
}
