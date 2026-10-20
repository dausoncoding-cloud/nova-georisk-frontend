import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExportCenter } from "./ExportCenter";
import type { ResultArtifact } from "./gisViewer";
const artifacts = [
  { key: "z", label: "Flood raster", artifact_type: "raster", format: "geotiff", result_version: 1, file_size_bytes: 0 },
  { key: "a", label: "Accuracy report", artifact_type: "report", format: "pdf", result_version: 1, file_size_bytes: 2048 },
] as ResultArtifact[];
describe("Artifact register", () => {
  it("searches, filters and sorts without changing protected download paths", () => {
    render(<ExportCenter resultId="result/1" artifacts={artifacts} createdAt="2026-01-01T00:00:00Z" />);
    expect(screen.getByText("0 B")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download Flood raster" })).toHaveAttribute("href", "/api/v1/results/result%2F1/products/z");
    fireEvent.click(screen.getByRole("button", { name: /Size/ }));
    expect(within(screen.getAllByRole("row")[1]!).getByText("Flood raster")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "accuracy" } });
    expect(screen.queryByRole("link", { name: "Download Flood raster" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "gis" } });
    expect(screen.getByText("No matching files")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
  it("paginates long result packages", () => {
    render(<ExportCenter resultId="one" artifacts={Array.from({ length: 25 }, (_, index) => ({ ...artifacts[0]!, key: String(index), label: `File ${String(index).padStart(2, "0")}` }))} />);
    expect(screen.getAllByRole("link")).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByText("21–25 of 25")).toBeInTheDocument();
  });
});
