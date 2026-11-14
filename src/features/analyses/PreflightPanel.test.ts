import { afterEach, describe, expect, it, vi } from "vitest";
import { nearestPassWindow, todayIso } from "./PreflightPanel";

describe("UTC 'today' for date bounds (the server rejects windows ending after today in UTC)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => { vi.useRealTimers(); process.env.TZ = originalTz; });

  it("uses the UTC date between 00:00 and 03:00 East Africa Time, when the local date is a day ahead", () => {
    process.env.TZ = "Africa/Dar_es_Salaam";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T22:30:00Z")); // 01:30 EAT on 15 November
    expect(new Date().getDate()).toBe(15); // the browser's local calendar date is already the 15th
    expect(todayIso()).toBe("2026-11-14"); // the UI bound follows the server (UTC)
  });

  it("agrees with the local date during the rest of the EAT day", () => {
    process.env.TZ = "Africa/Dar_es_Salaam";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T09:00:00Z")); // 12:00 EAT
    expect(todayIso()).toBe("2026-11-14");
  });
});

describe("nearest pass window", () => {
  const period = { start: "2024-05-21", end: "2024-05-23", sentinel1_pass_dates: [], relative_orbits: [], sentinel2_compliant_scenes: 0 };
  it("extends the current window to include the closer pass instead of replacing it", () => {
    // 2024-05-25 is 2 days after the end; 2024-05-13 is 8 days before the start. End dates are exclusive.
    expect(nearestPassWindow({ ...period, nearest_pass_before: "2024-05-13", nearest_pass_after: "2024-05-25" })).toEqual({ pass: "2024-05-25", start: "2024-05-21", end: "2024-05-26" });
    expect(nearestPassWindow({ ...period, nearest_pass_before: "2024-05-20", nearest_pass_after: "2024-06-06" })).toEqual({ pass: "2024-05-20", start: "2024-05-20", end: "2024-05-23" });
    expect(nearestPassWindow({ ...period, nearest_pass_before: null, nearest_pass_after: null })).toBeNull();
  });
});
