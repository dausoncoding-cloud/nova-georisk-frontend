import { afterEach, describe, expect, it } from "vitest";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrf";

describe("in-memory CSRF state", () => {
  afterEach(clearCsrfToken);

  it("retains the session token only in module memory", () => {
    setCsrfToken("csrf-value");
    expect(getCsrfToken()).toBe("csrf-value");
    expect(window.localStorage.getItem("csrfToken")).toBeNull();
    expect(window.sessionStorage.getItem("csrfToken")).toBeNull();
  });

  it("can be cleared when the session ends", () => {
    setCsrfToken("csrf-value");
    clearCsrfToken();
    expect(getCsrfToken()).toBeNull();
  });
});
