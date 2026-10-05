import { describe, expect, it } from "vitest";
import { protectedProductUrl } from "./resultsApi";

describe("protected product delivery", () => {
  it("builds the same-origin result product contract URL", () => {
    expect(protectedProductUrl("result-id", "flood_depth")).toBe(
      "/api/v1/results/result-id/products/flood_depth",
    );
  });

  it("encodes product identifiers instead of accepting path traversal", () => {
    expect(protectedProductUrl("result-id", "../private?download=true")).toBe(
      "/api/v1/results/result-id/products/..%2Fprivate%3Fdownload%3Dtrue",
    );
  });
});
