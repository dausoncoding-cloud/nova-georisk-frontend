// Client decision (2026-11-15): the product is called FRRIS. This guard fails if the word "FIRRIS" appears in
// any user-visible source: application code, the generated API descriptions, index.html or public assets.
// Identifiers such as FIRRISGisViewer or components["schemas"]["FIRRISProduct"] do not match the word boundary
// and are allowed. Tests are excluded because their fixtures mirror stored data (analysis_module "FIRRIS").
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { displayEngineKey, displayModuleName, FRRIS_ENGINE_KEY } from "./productName";

const ROOT = join(__dirname, "..", "..");
const WORD = /\bFIRRIS\b/;
// Kept on purpose: the mapping from the stored value "FIRRIS" to the display name.
const KEPT = new Set(["src/shared/productName.ts"]);

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("FRRIS product name", () => {
  it("never shows FIRRIS in user-visible sources", () => {
    const sources = [...files(join(ROOT, "src")), ...files(join(ROOT, "public")), join(ROOT, "index.html")]
      .filter((path) => /\.(tsx?|html|json|svg|txt|webmanifest|css)$/.test(path) && !/\.test\.tsx?$/.test(path));
    const offenders = sources.flatMap((path) => {
      const rel = relative(ROOT, path).split("\\").join("/");
      if (KEPT.has(rel)) return [];
      return readFileSync(path, "utf8").split("\n").flatMap((line, index) => WORD.test(line) ? [`${rel}:${index + 1}: ${line.trim().slice(0, 100)}`] : []);
    });
    expect(offenders).toEqual([]);
  });

  it("never renders a raw engine key (CSS uppercases \"firris\" to FIRRIS)", () => {
    const raw = /(?<!\$)\{\s*[\w.?]*engine_key\s*\}/; // JSX expressions, not template literals
    const offenders = files(join(ROOT, "src")).filter((path) => path.endsWith(".tsx") && !path.endsWith(".test.tsx"))
      .flatMap((path) => readFileSync(path, "utf8").split("\n").flatMap((line, index) => raw.test(line) ? [`${relative(ROOT, path)}:${index + 1}`] : []));
    expect(offenders).toEqual([]);
  });

  it("keeps its listed exceptions", () => {
    for (const rel of KEPT) expect(readFileSync(join(ROOT, rel), "utf8")).toMatch(WORD);
  });

  it("shows stored FIRRIS project modules as FRRIS and leaves the engine key alone", () => {
    expect(displayModuleName("FIRRIS")).toBe("FRRIS");
    expect(displayModuleName("WRAS")).toBe("WRAS");
    expect(displayModuleName(null)).toBe("");
    expect(FRRIS_ENGINE_KEY).toBe("firris");
    expect(displayEngineKey("firris")).toBe("FRRIS");
    expect(displayEngineKey("wras")).toBe("wras");
  });
});
