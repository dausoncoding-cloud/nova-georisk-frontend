// Trend Analysis: the Trends tab against the real Rufiji trend record (local dev-key run, 24–25 May 2024 target).
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import record from "./testdata/rufiji-trend-analysis.json";
import { decimalYear } from "./LineChart";
import { ResultTrendsTab, statisticsLine, trendRecord } from "./ResultTrendsTab";

const ID = "result-1";
const artifacts = ["trend_surface_water_annual_csv", "trend_rainfall_daily_csv", "trend_rainfall_dekadal_csv",
  "trend_sar_open_water_csv", "trend_rainfall_anomaly_csv"].map((key) => ({ key, label: key })) as never[];
const result = (trend: unknown) => ({ id: ID, summary: { trend_analysis: trend } }) as never;
const show = (trend: unknown = structuredClone(record)) => render(<ResultTrendsTab data={result(trend)} artifacts={artifacts} />);

describe("Trends tab", () => {
  it("is shown only for results with a trend record", () => {
    expect(trendRecord(result(record))).not.toBeNull();
    expect(trendRecord({ id: ID, summary: {} } as never)).toBeNull();
  });

  it("annual surface water: 10 flagged years hollow and as gaps, and no clear trend (no line, no slope headline)", () => {
    show();
    const card = screen.getByRole("region", { name: "Surface-water extent, annual (JRC, 1984–2021)" });
    const chart = within(card).getByRole("img");
    expect(chart).toHaveAccessibleName(/Surface water \(km²\) against Year/);
    expect(chart.querySelectorAll("[data-testid=flagged-point]")).toHaveLength(10);
    expect(chart.querySelector("[data-testid=trend-line]")).toBeNull();
    const path = chart.querySelector("[data-testid=series-line]")!.getAttribute("d")!;
    expect(path.match(/M/g)!.length).toBeGreaterThan(1); // flagged years break the line
    expect(within(card).getByLabelText("Statistics")).toHaveTextContent(
      /^n = 28 valid of 38 points; change 1986 → 2021: \+1\.67 km² \(83\.2%\); no statistically significant trend \(p = 0\.0712, R² = 0\.12\); no trend line drawn$/);
    expect(within(card).getByLabelText("Statistics")).not.toHaveTextContent("per year");
    expect(within(card).getByText(/Pekel/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Download CSV" })).toHaveAttribute("href", `/api/v1/results/${ID}/products/trend_surface_water_annual_csv`);
  });

  it("a statistically significant trend is drawn dashed and worded with slope, p and R²", () => {
    const trend = structuredClone(record) as unknown as { series: Record<string, Record<string, unknown>> };
    trend.series.surface_water_annual!.summary = { kind: "trend", n_valid: 7, text: "Statistically significant trend",
      change: { from: 2000, to: 2006, delta: 3.1, percent_text: "310.0%" },
      trend: { slope: 0.5, intercept: -999, r_squared: 0.95, p_value: 0.0002, slope_units: "km² per year", significant: true } };
    show(trend);
    const card = screen.getByRole("region", { name: "Surface-water extent, annual (JRC, 1984–2021)" });
    expect(within(card).getByRole("img").querySelector("[data-testid=trend-line]")).not.toBeNull();
    expect(within(card).getByLabelText("Statistics")).toHaveTextContent("statistically significant trend +0.500 km² per year, p = 0.0002, R² = 0.95 (dashed line; not a forecast)");
  });

  it("rainfall: no trend line, the anomaly table and its CSV", () => {
    show();
    const daily = screen.getByRole("region", { name: "Daily rainfall, 90 days to 25 May 2024" });
    expect(within(daily).getByRole("img").querySelector("[data-testid=trend-line]")).toBeNull();
    expect(within(daily).getByLabelText("Statistics")).toHaveTextContent(/^n = 90 valid of 90 points; Highest 86\.\d mm\/day \(2024-05-05\)\. No change or trend is computed for rainfall/);
    expect(within(daily).getByLabelText("Statistics")).not.toHaveTextContent("change 2024");
    const anomaly = screen.getByRole("region", { name: "Rainfall anomaly" });
    expect(anomaly).toHaveTextContent("90 days to 2024-05-25");
    expect(anomaly).toHaveTextContent("940.8");
    expect(anomaly).toHaveTextContent("+65.8% of the 1991–2020 mean");
  });

  it("SAR open water: the signed-off name and the caveats are on the card", () => {
    show();
    const card = screen.getByRole("region", { name: "SAR open water (VV < -18 dB) per Sentinel-1 pass" });
    expect(card).toHaveTextContent("Not the flood map — not accuracy-assessed");
    expect(card).toHaveTextContent("Not the FRRIS flood map and not accuracy-assessed.");
    expect(card).toHaveTextContent("Can miss water roughened by wind");
    expect(within(card).getByRole("img")).toHaveAccessibleName(/SAR open water \(km²\) against Date/);
    expect(within(card).getByRole("img").querySelector("[data-testid=trend-line]")).toBeNull();
    expect(within(card).getByLabelText("Statistics")).toHaveTextContent("seasonal; too short for a trend (the points span 0.8 years; a trend line needs at least 2)");
  });

  it("two points are a change, never a trend", () => {
    const series = { units: "km²", n_points: 2, summary: { kind: "change", n_valid: 2, text: "Change between the two valid points (two points are a change, not a trend).",
      change: { from: "2024-05-01", to: "2024-05-13", delta: 1, percent_text: "50.0%" } } };
    expect(statisticsLine(series)).toBe("n = 2 valid of 2 points; change 2024-05-01 → 2024-05-13: +1.00 km² (50.0%); Change between the two valid points (two points are a change, not a trend).");
    expect(statisticsLine(series)).not.toMatch(/trend [+-]/);
  });

  it("a series that could not be read, and a record that is not available", () => {
    const partial = structuredClone(record) as unknown as { series: Record<string, unknown> };
    partial.series.sar_open_water = { key: "sar_open_water", title: "SAR open water (VV < -18 dB)", status: "not_available", reason: "The run has no single Sentinel-1 orbit." };
    const first = show(partial);
    expect(screen.getByRole("status", { name: "SAR open water (VV < -18 dB)" })).toHaveTextContent("The run has no single Sentinel-1 orbit.");
    first.unmount();
    show({ status: "not_available", reason: "No trend series could be read for this run; the flood map is unaffected." });
    expect(screen.getByRole("status", { name: "Trend analysis" })).toHaveTextContent("the flood map is unaffected");
  });

  it("dates become decimal years like the API's trend line", () => {
    expect(decimalYear(2010)).toBe(2010);
    expect(decimalYear("2024-01-01")).toBe(2024);
  });
});
