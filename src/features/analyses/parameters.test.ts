import { describe, expect, it } from "vitest";
import { buildGeeSatelliteWorkflowParameters, defaultSatelliteWorkflowForm, parseAnalysisParameters, stagingFirrisParametersJson } from "./parameters";

describe("FIRRIS parameter payload", () => {
  it("provides executable staging inputs for every exposed FIRRIS product", () => {
    const parameters = parseAnalysisParameters(stagingFirrisParametersJson);
    expect(Object.keys(parameters)).toHaveLength(11);
    expect(parameters.flood_depth).toMatchObject({
      water_surface_elevation: expect.any(Array),
      ground_elevation: expect.any(Array),
    });
  });

  it.each(["not-json", "[]", "null"])("rejects invalid parameter object %s", (value) => {
    expect(() => parseAnalysisParameters(value)).toThrow();
  });

  it("builds a server-side GEE, QA, sampling, and Random Forest workflow", () => {
    const parameters = buildGeeSatelliteWorkflowParameters(defaultSatelliteWorkflowForm);
    expect(parameters.workflow?.source.provider).toBe("gee");
    expect(parameters.workflow?.preprocessing?.sar_speckle_filter).toBe(true);
    expect(parameters.workflow?.sampling).toMatchObject({ strategy: "stratified_random", sample_size: 5000 });
    expect(buildGeeSatelliteWorkflowParameters({
      ...defaultSatelliteWorkflowForm, samplingStrategy: "simple_random",
    }).workflow?.sampling?.strategy).toBe("simple_random");
    expect(parameters.workflow?.model).toMatchObject({ algorithm: "random_forest", n_estimators: 200 });
  });

  it("rejects reversed satellite date ranges", () => {
    expect(() => buildGeeSatelliteWorkflowParameters({
      ...defaultSatelliteWorkflowForm,
      targetStart: "2025-04-01", targetEnd: "2025-03-01",
    })).toThrow("start before");
  });

  it("serializes the complete default preprocessing configuration under workflow", () => {
    const parameters = buildGeeSatelliteWorkflowParameters(defaultSatelliteWorkflowForm);
    expect(parameters).not.toHaveProperty("preprocessing");
    expect(parameters.workflow?.preprocessing).toEqual({
      cloud_mask: true,
      sar_speckle_filter: true,
      sar_speckle_radius_m: 50,
      normalize_projection: true,
      clip_to_aoi: true,
    });
  });
});
