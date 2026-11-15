// Client decision (2026-11-15): the product is called FRRIS. The engine key ("firris") and the stored
// project field analysis_module ("FIRRIS" on existing projects) are data identifiers and stay as they are;
// only what users see changes.
export const FRRIS_ENGINE_KEY = "firris";

const STORED_NAMES: Record<string, string> = { FIRRIS: "FRRIS" };

export function displayModuleName(stored: string | null | undefined): string {
  const value = (stored ?? "").trim();
  return STORED_NAMES[value.toUpperCase()] ?? value;
}

const ENGINE_DISPLAY_NAMES: Record<string, string> = { [FRRIS_ENGINE_KEY]: "FRRIS" };

// Engine keys are shown as chips (often uppercased by CSS); show the product name instead of the key.
export function displayEngineKey(key: string | null | undefined): string {
  const value = key ?? "";
  return ENGINE_DISPLAY_NAMES[value] ?? value;
}
