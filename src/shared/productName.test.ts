// Client decision (2026-11-15): the product is called FRRIS. This guard fails if the word "FIRRIS" appears in
// any user-visible source: application code, the generated API descriptions, index.html or public assets.
// Identifiers such as FIRRISGisViewer or components["schemas"]["FIRRISProduct"] do not match the word boundary
// and are allowed. Tests are excluded because their fixtures mirror stored data (analysis_module "FIRRIS").
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { displayEngineKey, displayModuleName, displayProductText, FRRIS_ENGINE_KEY } from "./productName";

const ROOT = join(__dirname, "..", "..");
const WORD = /\bFIRRIS\b/;
// Client style (2026-11-15): no article before the name; write "the/this FRRIS analysis".
const ARTICLE = /\b(?:a|an)\s+FRRIS\b/i;
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
      // Test fixtures (*.test.ts[x] and testdata/ copies of API responses) mirror stored data and are not shipped.
      .filter((path) => /\.(tsx?|html|json|svg|txt|webmanifest|css)$/.test(path) && !/\.test\.tsx?$/.test(path) && !/[\\/]testdata[\\/]/.test(path));
    const offenders = sources.flatMap((path) => {
      const rel = relative(ROOT, path).split("\\").join("/");
      return readFileSync(path, "utf8").split("\n").flatMap((line, index) =>
        (WORD.test(line) && !KEPT.has(rel)) || ARTICLE.test(line) ? [`${rel}:${index + 1}: ${line.trim().slice(0, 100)}`] : []);
    });
    expect(offenders).toEqual([]);
  });

  it("never renders a raw engine key (CSS uppercases \"firris\" to FIRRIS)", () => {
    const raw = /(?<!\$)\{\s*[\w.?]*engine_key\s*\}/; // JSX expressions, not template literals
    const offenders = files(join(ROOT, "src")).filter((path) => path.endsWith(".tsx") && !path.endsWith(".test.tsx"))
      .flatMap((path) => readFileSync(path, "utf8").split("\n").flatMap((line, index) => raw.test(line) ? [`${relative(ROOT, path)}:${index + 1}`] : []));
    expect(offenders).toEqual([]);
  });

  it("article rule catches a/an before the name", () => {
    for (const bad of ["Submit a FRRIS analysis", "an FRRIS project", "A  FRRIS run"]) expect(ARTICLE.test(bad)).toBe(true);
    for (const good of ["the FRRIS analysis", "this FRRIS analysis", "data FRRIS"]) expect(ARTICLE.test(good)).toBe(false);
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
    expect(displayProductText("FIRRIS analysis workbook")).toBe("FRRIS analysis workbook");
    expect(displayProductText("firris-science-2")).toBe("firris-science-2");
  });
});
