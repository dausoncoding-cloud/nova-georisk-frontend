// Fonts are self-hosted: no external font requests, every @font-face file exists, and each family ships its OFL licence.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const FONTS_CSS = join(__dirname, "fonts.css");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("self-hosted fonts", () => {
  it("no source loads fonts or stylesheets from an external host", () => {
    const sources = [...files(join(ROOT, "src")), join(ROOT, "index.html")].filter((path) => /\.(tsx?|css|html)$/.test(path) && !path.endsWith(".test.ts"));
    const external = /fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny|@import\s+url\(\s*["']?https?:|<link[^>]+href=["']https?:/i;
    expect(sources.filter((path) => external.test(readFileSync(path, "utf8")))).toEqual([]);
  });

  it("declares Inter (UI) and IBM Plex Mono (numbers) from local woff2 files that exist", () => {
    const css = readFileSync(FONTS_CSS, "utf8");
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]!);
    expect(urls.length).toBeGreaterThanOrEqual(12);
    for (const url of urls) {
      expect(url).toMatch(/^\.\.\/assets\/fonts\/.+\.woff2$/);
      expect(existsSync(join(dirname(FONTS_CSS), url))).toBe(true);
    }
    expect(css).toMatch(/font-family: "Inter"/);
    expect(css).toMatch(/font-family: "IBM Plex Mono"/);
    const tokens = readFileSync(join(__dirname, "frris-refresh.css"), "utf8");
    expect(tokens).toMatch(/--fr-sans: Inter,/);
    expect(tokens).toMatch(/--fr-mono: "IBM Plex Mono",/);
  });

  it("ships the SIL Open Font License next to each family", () => {
    for (const family of ["inter", "ibm-plex-mono"]) {
      const licence = readFileSync(join(ROOT, "src", "assets", "fonts", family, "OFL.txt"), "utf8");
      expect(licence).toMatch(/SIL Open Font License, Version 1\.1/);
    }
  });
});
