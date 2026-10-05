import { describe, expect, it } from "vitest";
import { geometryToSvgPaths } from "./AoiGeometryPreview";

describe("AOI geometry preview", () => {
  it("creates an SVG path for a Polygon boundary", () => {
    const paths = geometryToSvgPaths({
      type: "Polygon",
      coordinates: [[[36, -2], [37, -2], [37, -1], [36, -1], [36, -2]]],
    });
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^M/);
    expect(paths[0]).toMatch(/ Z$/);
  });

  it("keeps every MultiPolygon ring selectable", () => {
    const paths = geometryToSvgPaths({
      type: "MultiPolygon",
      coordinates: [
        [[[36, -2], [37, -2], [37, -1], [36, -1], [36, -2]]],
        [[[38, -2], [39, -2], [39, -1], [38, -1], [38, -2]]],
      ],
    });
    expect(paths).toHaveLength(2);
  });
});
