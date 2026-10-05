import { describe, expect, it } from "vitest";
import { buildLoginUrl, sanitizeReturnTo } from "./authNavigation";

describe("sanitizeReturnTo", () => {
  it("keeps a relative NOVA route", () => {
    expect(sanitizeReturnTo("/projects?status=active#top")).toBe("/projects?status=active#top");
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "/auth/callback",
    "projects",
  ])("rejects unsafe return target %s", (target) => {
    expect(sanitizeReturnTo(target)).toBe("/projects");
  });
});

describe("buildLoginUrl", () => {
  it("builds a provider-neutral BFF login URL", () => {
    expect(buildLoginUrl("/projects", "00000000-0000-0000-0000-000000000001")).toBe(
      "/auth/login?return_to=%2Fprojects&organization_id=00000000-0000-0000-0000-000000000001",
    );
  });
});
