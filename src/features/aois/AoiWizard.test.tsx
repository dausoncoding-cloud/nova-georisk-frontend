import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../shared/ui/Toast";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { AoiWizard } from "./AoiWizard";
import { createAoi, createAoiFromAdministrativeBoundary, inspectGeopackageLayers, searchAdministrativeBoundaries } from "./aoisApi";

vi.mock("./aoisApi", () => ({
  createAoi: vi.fn(), uploadGeopackageAoi: vi.fn(), uploadShapefileAoi: vi.fn(),
  inspectGeopackageLayers: vi.fn(), searchAdministrativeBoundaries: vi.fn(),
  createAoiFromAdministrativeBoundary: vi.fn(),
}));

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = vi.fn();
  render(<QueryClientProvider client={client}><ToastProvider><AoiWizard projectId="00000000-0000-0000-0000-000000000001" onClose={onClose} /></ToastProvider></QueryClientProvider>);
  return { onClose };
}

const boundary: components["schemas"]["AdministrativeBoundaryChoice"] = {
  dataset_id: "00000000-0000-0000-0000-000000000002", spatial_unit_id: "ward-7", name: "Zone Alpha", level: "ward",
  source_id: "reviewed-admin-v1", source_sha256: "a".repeat(64), source_version: "2026-09-20T00:00:00Z",
  producer: "National Mapping Agency", custodian: "Survey Office", licence_identifier: "survey-licence",
  permitted_use: "NOVA analysis", redistribution: "restricted", observed_at: "2025-01-01T00:00:00Z",
  reviewed_at: "2026-09-21T00:00:00Z", positional_uncertainty_m: 5,
  geometry: { type: "Polygon", coordinates: [[[36, -2], [37, -2], [37, -1], [36, -1], [36, -2]]] },
};

describe("AOI creation wizard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes GeoPackage upload and approved administrative boundaries", () => {
    renderWizard();
    expect(screen.getByRole("button", { name: /GeoPackage/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Admin boundary/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /GeoJSON/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/Drop a file here or browse/i)).toBeInTheDocument();
    expect(screen.getByText(/Polygon or MultiPolygon/i)).toBeInTheDocument();
  });

  it("reviews a GeoPackage as server-validated rather than inventing a local preview", async () => {
    vi.mocked(inspectGeopackageLayers).mockResolvedValue({
      layers: [{ name: "boundary", geometry_type: "Polygon" }],
    });
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /GeoPackage/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const file = new File(["fixture"], "boundary.gpkg", { type: "application/geopackage+sqlite3" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("combobox", { name: /GeoPackage polygon layer/i })).toHaveValue("boundary"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/Source geometry is not rendered locally/)).toBeInTheDocument();
    expect(screen.getByText(/layer boundary/)).toBeInTheDocument();
  });

  it("requires explicit selection when the protected API finds several polygon layers", async () => {
    vi.mocked(inspectGeopackageLayers).mockResolvedValue({
      layers: [{ name: "upper", geometry_type: "Polygon" }, { name: "lower", geometry_type: "MultiPolygon" }],
    });
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /GeoPackage/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(["fixture"], "multi.gpkg")] },
    });
    const selector = await screen.findByRole("combobox", { name: /GeoPackage polygon layer/i });
    expect(selector).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Select a GeoPackage polygon layer/);
    fireEvent.change(selector, { target: { value: "lower" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/layer lower/)).toBeInTheDocument();
  });

  it("shows project-scoped empty and error states without selecting a boundary", async () => {
    vi.mocked(searchAdministrativeBoundaries).mockResolvedValueOnce({ items: [], total: 0, limit: 25, offset: 0 })
      .mockRejectedValueOnce(new Error("Approved catalogue unavailable"));
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Admin boundary/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Select an approved administrative boundary/);
    fireEvent.change(screen.getByRole("textbox", { name: /Search administrative boundaries/i }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Search approved boundaries" }));
    expect(await screen.findByText(/No approved boundaries matched/)).toBeInTheDocument();
    expect(searchAdministrativeBoundaries).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001", "Alpha", 25, 0);
    fireEvent.change(screen.getByRole("textbox", { name: /Search administrative boundaries/i }), { target: { value: "Bravo" } });
    fireEvent.click(screen.getByRole("button", { name: "Search approved boundaries" }));
    expect(await screen.findByText("Approved catalogue unavailable")).toBeInTheDocument();
    expect(createAoiFromAdministrativeBoundary).not.toHaveBeenCalled();
  });

  it("shows loading and supports paginated catalogue results without changing project scope", async () => {
    let releaseFirst: ((page: { items: typeof boundary[]; total: number; limit: number; offset: number }) => void) | undefined;
    vi.mocked(searchAdministrativeBoundaries)
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValueOnce({ items: [boundary], total: 26, limit: 25, offset: 25 });
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Admin boundary/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Search administrative boundaries/i }), { target: { value: "ward" } });
    fireEvent.click(screen.getByRole("button", { name: "Search approved boundaries" }));
    expect(screen.getByText(/Loading approved boundaries/)).toBeInTheDocument();
    releaseFirst?.({ items: [boundary], total: 26, limit: 25, offset: 0 });
    const next = await screen.findByRole("button", { name: "Next boundaries" });
    fireEvent.click(next);
    await waitFor(() => expect(searchAdministrativeBoundaries).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001", "ward", 25, 25,
    ));
  });

  it("shows provenance, reviews geometry, and creates through the protected ID-only contract", async () => {
    vi.mocked(searchAdministrativeBoundaries).mockResolvedValue({ items: [boundary], total: 1, limit: 25, offset: 0 });
    vi.mocked(createAoiFromAdministrativeBoundary).mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000003", project_id: "00000000-0000-0000-0000-000000000001",
      name: "Untitled AOI", source_type: "admin_boundary", geometry: boundary.geometry, crs: "EPSG:4326",
      stats: { area_m2: 1, area_hectares: 0.0001, area_km2: 0.000001, perimeter_m: 4 },
      created_at: "2026-09-22T00:00:00Z", source_lineage: { dataset_id: boundary.dataset_id, sha256: boundary.source_sha256 },
    });
    const { onClose } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Admin boundary/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Search administrative boundaries/i }), { target: { value: "Zone" } });
    fireEvent.click(screen.getByRole("button", { name: "Search approved boundaries" }));
    const choice = await screen.findByRole("button", { name: /Zone Alpha/ });
    expect(choice).toHaveTextContent("National Mapping Agency");
    expect(choice).toHaveTextContent("survey-licence");
    fireEvent.click(choice);
    expect(screen.getByLabelText("Selected boundary provenance")).toHaveTextContent(boundary.source_sha256);
    expect(screen.getByLabelText("Selected boundary provenance")).toHaveTextContent("redistribution restricted");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Administrative boundary review")).toHaveTextContent("reviewed-admin-v1");
    fireEvent.click(screen.getByRole("button", { name: "Create AOI" }));
    await waitFor(() => expect(createAoiFromAdministrativeBoundary).toHaveBeenCalledWith({
      project_id: "00000000-0000-0000-0000-000000000001", dataset_id: boundary.dataset_id,
      spatial_unit_id: "ward-7", name: "Untitled AOI",
    }));
    expect(createAoi).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("keeps the wizard open when server approval changes before boundary creation", async () => {
    vi.mocked(searchAdministrativeBoundaries).mockResolvedValue({ items: [boundary], total: 1, limit: 25, offset: 0 });
    vi.mocked(createAoiFromAdministrativeBoundary).mockRejectedValue(new Error("Source is not approved for scientific analysis"));
    const { onClose } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Admin boundary/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Search administrative boundaries/i }), { target: { value: "Zone" } });
    fireEvent.click(screen.getByRole("button", { name: "Search approved boundaries" }));
    fireEvent.click(await screen.findByRole("button", { name: /Zone Alpha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create AOI" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Source is not approved for scientific analysis");
    expect(onClose).not.toHaveBeenCalled();
    expect(createAoi).not.toHaveBeenCalled();
  });
});
