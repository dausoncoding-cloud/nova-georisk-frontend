import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataCatalogPage } from "./DataCatalogPage";

describe("DataCatalogPage", () => {
  it("describes Sentinel-1 use as flood-candidate mapping, never a bare flood extent (F3)", () => {
    const { container } = render(<DataCatalogPage />);
    expect(container.textContent).not.toMatch(/flood extent/i);
    expect(screen.getByText(/Flood-candidate mapping \(model-classified\) and backscatter change/)).toBeTruthy();
  });
});
