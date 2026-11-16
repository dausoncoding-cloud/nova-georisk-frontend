import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAreaCapacity, createAoi, type AreaCapacityResponse } from "../aois/aoisApi";
import { fetchProjects } from "../projects/projectsApi";
import { AreaPlaygroundPage } from "./AreaPlaygroundPage";
import { areasToSave, coarserAdvice, currentFigures, featureCollection, polygonFromPoints, previewPaths, rectangleFromCorners } from "./playgroundView";

vi.mock("../aois/aoisApi", async (load) => ({ ...await load<typeof import("../aois/aoisApi")>(), checkAreaCapacity: vi.fn(), createAoi: vi.fn() }));
vi.mock("../projects/projectsApi", async (load) => ({ ...await load<typeof import("../projects/projectsApi")>(), fetchProjects: vi.fn() }));
// The Leaflet map is replaced by a stub that "draws" through the same callbacks.
vi.mock("./PlaygroundMap", () => ({
  PlaygroundMap: (props: { onFinish: (points: [number, number][]) => void; parts: { label: string }[]; trimBox: number[] | null }) => <div data-testid="map">
    <button type="button" onClick={() => props.onFinish([[38.92, -7.99], [39.01, -7.9]])}>stub: draw rectangle</button>
    {props.parts.map((part) => <span key={part.label}>{part.label}</span>)}
    {props.trimBox ? <span>stub: trim box shown</span> : null}
  </div>,
}));

const MIB = 1_048_576;
const cap = (mib: number, scale = 30) => ({ scale_m: scale, bbox_pixels: 1, estimated_request_bytes: Math.round(mib * MIB), limit_bytes: 50_331_648, ratio: mib / 48, suggested_scale_m: null });
const poly = (w: number, s: number, e: number, n: number) => ({ type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
const FITS: AreaCapacityResponse = { status: "fits", message: "Fits comfortably in one analysis.", area_km2: 98.8, bbox: [38.92, -7.99, 39.01, -7.9], bbox_km2: 98.8, capacity: cap(10), near_ratio: 0.9, trim: null, split: null, coarser: null };
const OVER: AreaCapacityResponse = {
  status: "over", message: "Too large for one analysis: about 2.1 times the 48 MiB limit. Choose a way to make it fit.", area_km2: 820, bbox: [36, -8.6, 36.3, -8.2], bbox_km2: 1010, capacity: cap(99.5), near_ratio: 0.9,
  trim: { geometry: poly(36.05, -8.5, 36.25, -8.3), area_km2: 484, bbox: [36.05, -8.5, 36.25, -8.3], box: [36.05, -8.5, 36.25, -8.3], capacity: cap(47.7) },
  split: { rows: 1, cols: 3, parts: [0, 1, 2].map((index) => ({ geometry: poly(36 + index * 0.1, -8.6, 36.1 + index * 0.1, -8.2), area_km2: 273, bbox: [36 + index * 0.1, -8.6, 36.1 + index * 0.1, -8.2], capacity: cap(33.2) })) },
  coarser: { scale_m: 60, capacity: cap(24.9, 60) },
} as AreaCapacityResponse;

function setup() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><AreaPlaygroundPage /></MemoryRouter></QueryClientProvider>);
}
async function drawArea() {
  fireEvent.click(await screen.findByRole("button", { name: "Rectangle" }));
  fireEvent.click(screen.getByRole("button", { name: "stub: draw rectangle" }));
}

beforeEach(() => {
  vi.mocked(fetchProjects).mockReset().mockResolvedValue([{ id: "p1", name: "Kilombero valley", engine_key: "firris" }, { id: "px", name: "Wildfire pilot", engine_key: "wras" }] as never);
  vi.mocked(checkAreaCapacity).mockReset().mockResolvedValue(FITS);
  let next = 0;
  vi.mocked(createAoi).mockReset().mockImplementation(async (body) => ({ id: `aoi-${++next}`, ...body }) as never);
});
afterEach(() => vi.unstubAllGlobals());

describe("playground helpers", () => {
  it("builds polygons and rectangles from clicks", () => {
    expect(polygonFromPoints([[0, 0], [1, 0]])).toBeNull();
    expect(polygonFromPoints([[0, 0], [1, 0], [1, 1]])?.coordinates).toEqual([[[0, 0], [1, 0], [1, 1], [0, 0]]]);
    expect(rectangleFromCorners([1, 1], [0, 0])?.coordinates).toEqual([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]);
    expect(rectangleFromCorners([1, 1], [1, 2])).toBeNull();
  });
  it("shows the figures of the applied fix and saves the matching areas", () => {
    expect(currentFigures(OVER, null)).toMatchObject({ tone: "over", bytes: Math.round(99.5 * MIB) });
    expect(currentFigures(OVER, "trim")).toMatchObject({ tone: "near", areaKm2: 484 });
    expect(currentFigures(OVER, "split")).toMatchObject({ tone: "ok", bytes: Math.round(33.2 * MIB) });
    expect(currentFigures(OVER, "coarser")).toMatchObject({ scale: 60, bytes: Math.round(24.9 * MIB) });
    const geometry = poly(36, -8.6, 36.3, -8.2);
    expect(areasToSave(OVER, "split", geometry, "Kilombero").map((area) => area.name)).toEqual(["Kilombero (part 1 of 3)", "Kilombero (part 2 of 3)", "Kilombero (part 3 of 3)"]);
    expect(areasToSave(OVER, "trim", geometry, "Kilombero")).toEqual([{ name: "Kilombero (trimmed)", geometry: OVER.trim!.geometry }]);
    expect(areasToSave(OVER, "coarser", geometry, "Kilombero")).toEqual([{ name: "Kilombero", geometry }]);
    expect(featureCollection([{ name: "A", geometry }], 60).features[0]).toMatchObject({ type: "Feature", properties: { name: "A", scale_m: 60, crs: "EPSG:4326" } });
    expect(previewPaths([geometry], [[36.05, -8.5, 36.25, -8.3]]).boxes).toHaveLength(1);
  });
});

describe("coarser resolution wording (r5.1)", () => {
  it("says detail is reduced at 60 m and strongly reduced at 120 m, recommending Split there", () => {
    expect(coarserAdvice(60, true)).toEqual({ detail: "Map detail is reduced: each 60 m pixel replaces 4 pixels of the 30 m map.", recommendSplit: false });
    expect(coarserAdvice(120, true)).toEqual({ detail: "Map detail is strongly reduced: each 120 m pixel replaces 16 pixels of the 30 m map.", recommendSplit: true });
    expect(coarserAdvice(120, false).recommendSplit).toBe(false); // no split offered: nothing to recommend
  });

  it("shows the strong reduction and the Split recommendation on the 120 m option and after applying it", async () => {
    vi.mocked(checkAreaCapacity).mockResolvedValue({ ...OVER, coarser: { scale_m: 120, capacity: cap(44.3, 120) } } as AreaCapacityResponse);
    setup();
    await drawArea();
    const option = (await screen.findByRole("radio", { name: /Use 120 m resolution/ })).closest("label")!;
    expect(option).toHaveTextContent("Map detail is strongly reduced: each 120 m pixel replaces 16 pixels of the 30 m map.");
    expect(option).toHaveTextContent("Recommended: Split keeps the 30 m detail");
    fireEvent.click(within(option).getByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText(/Whole area fits at 120 m resolution\. Map detail is strongly reduced.*Split keeps the 30 m detail and is the better choice\./)).toBeInTheDocument();
  });
});

describe("Area playground", () => {
  it("checks a drawn area with the API and shows the meter in MiB", async () => {
    setup();
    await drawArea();
    expect(await screen.findByText("Fits comfortably in one analysis.")).toBeInTheDocument();
    expect(checkAreaCapacity).toHaveBeenCalledWith({ geometry: poly(38.92, -7.99, 39.01, -7.9), scale_m: 30, trim_center: null });
    expect(screen.getByRole("img", { name: "10.0 of 48.0 MiB" })).toBeInTheDocument();
    expect(screen.getByLabelText("Area figures")).toHaveTextContent("Area 98.8 km²Box 99 km²Resolution 30 m");
    expect(screen.queryByRole("heading", { name: "Make it fit" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save to my areas" })).toBeEnabled();
    expect([...screen.getByRole("combobox", { name: "Project" }).querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Kilombero valley"]);
  });

  it("an area over the limit cannot be saved until a fix is applied; split saves N areas", async () => {
    vi.mocked(checkAreaCapacity).mockResolvedValue(OVER);
    setup();
    await drawArea();
    expect(await screen.findByText(/about 2.1 times the 48 MiB limit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to my areas" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download GeoJSON" })).toBeDisabled();
    expect(screen.getByText("Make the area fit first: choose an option above and press Apply.")).toBeInTheDocument();
    const options = screen.getByRole("group", { name: "Choose how to fit the area" });
    expect(within(options).getAllByRole("radio")).toHaveLength(3);
    expect(within(options).getAllByRole("img").map((img) => img.getAttribute("aria-label"))).toEqual([
      "Preview: the trimmed box on the area", "Preview: the area split into 3 parts", "Preview: the whole area"]);
    fireEvent.click(within(options).getByRole("radio", { name: /Split into 3 parts/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("1/3 · 33.2 MiB")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Kilombero valley" } });
    fireEvent.click(screen.getByRole("button", { name: "Save 3 areas" }));
    await waitFor(() => expect(createAoi).toHaveBeenCalledTimes(3));
    expect(vi.mocked(createAoi).mock.calls.map(([body]) => body.name)).toEqual(["Kilombero valley (part 1 of 3)", "Kilombero valley (part 2 of 3)", "Kilombero valley (part 3 of 3)"]);
    expect(vi.mocked(createAoi).mock.calls[0]![0]).toMatchObject({ project_id: "p1", source_type: "rectangle_from_coords", crs: "EPSG:4326", geometry: OVER.split!.parts[0]!.geometry });
    expect(await screen.findByRole("link", { name: "Start a new analysis" })).toHaveAttribute("href", "/frris/analyses/new?project=p1&aoi_id=aoi-1");
  });

  it("trim: the box can be moved, which asks the API again with the new centre", async () => {
    vi.mocked(checkAreaCapacity).mockResolvedValue(OVER);
    setup();
    await drawArea();
    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect(screen.getByText("stub: trim box shown")).toBeInTheDocument();
    expect(screen.getByText("Trimmed area fits. Move the box to cover the part you need most.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "47.7 of 48.0 MiB" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Move the trimmed box" })).getByRole("button", { name: "East" }));
    await waitFor(() => expect(checkAreaCapacity).toHaveBeenLastCalledWith(expect.objectContaining({ trim_center: [36.2, -8.4] })));
    fireEvent.click(screen.getByRole("button", { name: "Save to my areas" }));
    await waitFor(() => expect(createAoi).toHaveBeenCalledWith(expect.objectContaining({ name: "New area (trimmed)", geometry: OVER.trim!.geometry })));
  });

  it("coarser: keeps the whole area and carries 60 m into New analysis; GeoJSON downloads", async () => {
    vi.mocked(checkAreaCapacity).mockResolvedValue(OVER);
    const created: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (blob: Blob) => { created.push(blob); return "blob:x"; }, revokeObjectURL: () => undefined }));
    setup();
    await drawArea();
    fireEvent.click(await screen.findByRole("radio", { name: /Use 60 m resolution/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("img", { name: "24.9 of 48.0 MiB" })).toBeInTheDocument();
    expect(screen.getByLabelText("Area figures")).toHaveTextContent("Resolution 60 m");
    fireEvent.click(screen.getByRole("button", { name: "Download GeoJSON" }));
    const text = await created[0]!.text();
    expect(JSON.parse(text)).toMatchObject({ type: "FeatureCollection", features: [{ properties: { name: "New area", scale_m: 60 } }] });
    fireEvent.click(screen.getByRole("button", { name: "Save to my areas" }));
    expect(await screen.findByRole("link", { name: "Start a new analysis" })).toHaveAttribute("href", "/frris/analyses/new?project=p1&aoi_id=aoi-1&scale=60");
  });

  it("shows the API's refusal for an invalid area", async () => {
    vi.mocked(checkAreaCapacity).mockRejectedValue(new Error("Invalid AOI geometry: Self-intersection"));
    setup();
    await drawArea();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid AOI geometry: Self-intersection");
  });
});
