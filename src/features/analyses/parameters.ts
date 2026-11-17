import type { AnalysisSubmitRequest } from "./analysisApi";

export const stagingFirrisParameters = {
  flood_extent: {
    backscatter_before: [[2.4, 2.1], [2.8, 2.5]],
    backscatter_during: [[1.0, 1.8], [1.2, 2.0]],
    change_ratio_threshold: 1.5,
  },
  flood_depth: {
    water_surface_elevation: [[102.4, 103.1], [101.8, 102.7]],
    ground_elevation: [[101.1, 101.9], [101.2, 101.5]],
  },
  flood_velocity: {
    discharge: [[18, 24], [15, 21]],
    cross_sectional_area: [[9, 8], [10, 7]],
  },
  flood_hazard: {
    depth: [[0.4, 1.2], [0.8, 1.8]],
    velocity: [[0.3, 0.8], [0.5, 1.1]],
  },
  flood_probability: { annual_probability: [0.1, 0.25, 0.5, 0.8] },
  flood_duration: { duration_days: [0.5, 2, 5, 10] },
  flood_exposure: { normalized_density: [0.15, 0.4, 0.7, 0.95] },
  flood_vulnerability: { fvi: [0.2, 0.45, 0.7, 0.9] },
  flood_risk: {
    hazard: [0.2, 0.5, 0.8, 0.95],
    exposure: [0.3, 0.45, 0.75, 0.9],
    vulnerability: [0.25, 0.5, 0.65, 0.85],
  },
  flood_susceptibility: { susceptibility: [0.1, 0.4, 0.7, 0.9] },
  flood_hazard_zonation: { zonation_score: [0.15, 0.45, 0.75, 0.95] },
};

export const stagingFirrisParametersJson = JSON.stringify(stagingFirrisParameters, null, 2);

export type SatelliteWorkflowForm = {
  targetStart: string;
  targetEnd: string;
  baselineStart: string;
  baselineEnd: string;
  maxCloudPct: number;
  scale: number;
  sampleSize: number;
  samplingStrategy: "stratified_random" | "simple_random";
  trainFraction: number;
  cloudMask: boolean;
  sarSpeckleFilter: boolean;
  normalizeProjection: boolean;
  /** Depth & Exposure module: add the GloFAS modelled river-flood hazard as context (opt-in; never changes the flood map). */
  modelledFloodHazard: boolean;
  /** Depth & Exposure module: estimated people and buildings inside each extent (needs the modelled hazard). */
  floodExposure: boolean;
};

export const defaultSatelliteWorkflowForm: SatelliteWorkflowForm = {
  targetStart: "2025-03-01",
  targetEnd: "2025-04-01",
  baselineStart: "2024-03-01",
  baselineEnd: "2024-04-01",
  maxCloudPct: 20,
  scale: 30,
  sampleSize: 5000,
  samplingStrategy: "stratified_random",
  trainFraction: 0.7,
  cloudMask: true,
  sarSpeckleFilter: true,
  normalizeProjection: true,
  modelledFloodHazard: false,
  floodExposure: false,
};

// Fixed parts of the FRRIS run (not user-editable). Shown read-only in the builder; sent as-is in the payload.
export const FIXED_RUN_SETTINGS = {
  minimumValidCoveragePct: 70,
  speckleRadiusM: 50,
  minPerClass: 30,
  randomSeed: 12345,
  algorithm: "random_forest",
  modelVersion: "1.0",
  nEstimators: 200,
  datasets: ["COPERNICUS/S1_GRD", "COPERNICUS/S2_SR_HARMONIZED", "UCSB-CHG/CHIRPS/DAILY", "USGS/SRTMGL1_003", "JRC/GSW1_4/GlobalSurfaceWater"],
  features: ["sar_vv_target", "sar_change", "elevation", "slope", "rainfall"],
} as const;

export function buildGeeSatelliteWorkflowParameters(form: SatelliteWorkflowForm): AnalysisSubmitRequest["parameters"] {
  if (!form.targetStart || !form.targetEnd || !form.baselineStart || !form.baselineEnd) {
    throw new Error("Target and baseline date ranges are required.");
  }
  if (form.targetStart >= form.targetEnd || form.baselineStart >= form.baselineEnd) {
    throw new Error("Each date range must start before it ends.");
  }
  return {
    workflow: {
      source: {
        provider: "gee",
        date_mode: "pre-post",
        datasets: [...FIXED_RUN_SETTINGS.datasets],
        target_period: { start: form.targetStart, end: form.targetEnd },
        baseline_period: { start: form.baselineStart, end: form.baselineEnd },
        max_cloud_pct: form.maxCloudPct,
        minimum_valid_coverage_pct: FIXED_RUN_SETTINGS.minimumValidCoveragePct,
        scale: form.scale,
        target_crs: "EPSG:4326",
        dem_source: "SRTM",
        features: [...FIXED_RUN_SETTINGS.features],
      },
      preprocessing: {
        cloud_mask: form.cloudMask,
        preview_enhancement: false,
        sar_speckle_filter: form.sarSpeckleFilter,
        sar_speckle_radius_m: FIXED_RUN_SETTINGS.speckleRadiusM,
        normalize_projection: form.normalizeProjection,
        clip_to_aoi: true,
      },
      sampling: {
        strategy: form.samplingStrategy,
        sample_size: form.sampleSize,
        min_per_class: FIXED_RUN_SETTINGS.minPerClass,
        train_fraction: form.trainFraction,
        random_seed: FIXED_RUN_SETTINGS.randomSeed,
      },
      model: { algorithm: FIXED_RUN_SETTINGS.algorithm, version: FIXED_RUN_SETTINGS.modelVersion, n_estimators: FIXED_RUN_SETTINGS.nEstimators },
      quality: {},
      // Sent only when chosen, so requests without the option are unchanged.
      ...(form.modelledFloodHazard
        ? { context: { modelled_flood_hazard: true, flood_exposure: form.floodExposure } }
        : {}),
    },
  };
}

export function parseAnalysisParameters(value: string): AnalysisSubmitRequest["parameters"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Analysis parameters must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Analysis parameters must be a JSON object.");
  }
  // The browser schema deliberately leaves the engine-specific object open.
  // Runtime parsing enforces an object while the worker validates its product fields.
  return parsed as AnalysisSubmitRequest["parameters"];
}
