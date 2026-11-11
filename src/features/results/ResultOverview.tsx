import type { components } from "../../shared/api/generated/nova-browser-api";

type Overview = components["schemas"]["ResultOverview"];

const DASH = "—";
const cells = new Intl.NumberFormat("en-US");
const num = (value: number | null | undefined, digits = 2) => (value === null || value === undefined || !Number.isFinite(value) ? DASH : value.toFixed(digits));
const statusLabel: Record<string, string> = { pass: "Pass", fail: "Fail", not_recorded: "Not recorded", not_applicable: "Not applicable" };

export function ResultOverview({ overview }: { overview: Overview }) {
  const area = overview.area_accounting;
  return (
    <section className="result-overview" aria-label="Result overview">
      <section data-section="headline" aria-label="What this result shows">
        <h2>What this result shows</h2>
        <p>{overview.headline.text}</p>
      </section>
      <section data-section="area" aria-label="Area accounting">
        <h2>Area accounting</h2>
        <dl className="metadata-list">
          <div><dt>Valid analysed area</dt><dd>{num(area.valid_area_km2)} km² ({num(area.valid_pct_of_aoi)}% of AOI)</dd></div>
          <div><dt>AOI area (estimate)</dt><dd>{num(area.aoi_area_km2_estimate)} km² · {area.aoi_cells === null ? DASH : cells.format(area.aoi_cells)} cells</dd></div>
          <div><dt>Excluded (no valid data)</dt><dd>{num(area.excluded_area_km2_estimate)} km² · {area.excluded_cells === null ? DASH : cells.format(area.excluded_cells)} cells</dd></div>
          <div><dt>Flood candidates</dt><dd>{num(area.flood_candidate_area_km2)} km² · {num(area.flood_candidate_pct_of_valid)}% of valid · {num(area.flood_candidate_pct_of_aoi)}% of AOI</dd></div>
        </dl>
        {area.missing_cells_by_band.length ? (
          <div className="table-wrap"><table>
            <caption>Missing cells by band</caption>
            <thead><tr><th scope="col">Band</th><th scope="col">Cells</th><th scope="col">% of AOI</th><th scope="col">Affects admission</th></tr></thead>
            <tbody>{area.missing_cells_by_band.map(row => <tr key={row.band}><th scope="row">{row.band}</th><td>{cells.format(row.cells)}</td><td>{num(row.pct_of_aoi)}%</td><td>{row.affects_admission ? "Yes" : "No (reference only)"}</td></tr>)}</tbody>
          </table></div>
        ) : null}
        <p className="notice">{area.method_note}</p>
      </section>
      <section data-section="gates" aria-label="Quality gates">
        <h2>Quality gates</h2>
        <div className="table-wrap"><table>
          <caption>Quality gates</caption>
          <thead><tr><th scope="col">Gate</th><th scope="col">Threshold</th><th scope="col">Observed</th><th scope="col">Status</th></tr></thead>
          <tbody>{overview.quality_gates.map(gate => <tr key={gate.name} className={`gate gate--${gate.status}`}><th scope="row">{gate.name}</th><td>{gate.threshold}</td><td>{gate.observed ?? DASH}</td><td>{statusLabel[gate.status] ?? gate.status}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section data-section="sources" aria-label="Data sources">
        <h2>Data sources</h2>
        <div className="table-wrap"><table>
          <caption>Data sources</caption>
          <thead><tr><th scope="col">Dataset</th><th scope="col">Role</th><th scope="col">Resolution</th><th scope="col">Scene dates</th><th scope="col">Credit</th></tr></thead>
          <tbody>{overview.data_sources.map(source => <tr key={source.dataset}><th scope="row"><code>{source.dataset}</code></th><td>{source.role}</td><td>{source.resolution}</td><td>{source.scene_dates.length ? source.scene_dates.join(", ") : "static product"}</td><td>{source.credit}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section data-section="limitations" aria-label="Limitations">
        <h2>Limitations</h2>
        {overview.limitations.length ? <ul>{overview.limitations.map(text => <li key={text}>{text}</li>)}</ul> : <p>No limitations were recorded for this result.</p>}
      </section>
    </section>
  );
}
