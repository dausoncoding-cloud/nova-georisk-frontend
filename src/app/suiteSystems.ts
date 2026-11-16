import { FRRIS_ENGINE_KEY } from "../shared/productName";

// The NOVA-GeoRisk suite. FRRIS is the only system with a working frontend; WRRIS and MEGIS are shown as
// "In development" and are never links. FRRIS availability for the organization comes from GET /api/v1/engines.
export type SuiteSystem = {
  key: "frris" | "wrris" | "megis";
  name: string;
  domain: string;
  title?: string;
  description?: string;
  icon: "flood" | "wildfire" | "mineral";
  engineKey?: string;
  route?: string;
};

export const SUITE_SYSTEMS: readonly SuiteSystem[] = [
  {
    key: "frris",
    name: "FRRIS",
    domain: "Flood risk",
    title: "Flood Risk & Resilience Intelligence",
    description: "Sentinel-1 flood-candidate mapping with an independent Sentinel-2 accuracy assessment.",
    icon: "flood",
    engineKey: FRRIS_ENGINE_KEY,
    route: "/frris",
  },
  { key: "wrris", name: "WRRIS", domain: "Wildfire risk", icon: "wildfire" },
  { key: "megis", name: "MEGIS", domain: "Mineral exploration", icon: "mineral" },
];

export const FRRIS_SYSTEM = SUITE_SYSTEMS[0]!;

export type EngineAccess = { key: string; access?: boolean };

export type SystemAvailability = "active" | "not-enabled" | "unknown" | "in-development";

// "unknown" (engines not loaded or failed) keeps the FRRIS link: the API still authorizes every request.
export function systemAvailability(system: SuiteSystem, engines: readonly EngineAccess[] | undefined): SystemAvailability {
  if (!system.engineKey || !system.route) return "in-development";
  if (!engines) return "unknown";
  const engine = engines.find((candidate) => candidate.key === system.engineKey);
  return engine && engine.access !== false ? "active" : "not-enabled";
}
