import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { IdempotentAction } from "./idempotency";

const failure = (status: number, code = `http_${status}`) => new ApiError({ message: "x", status, code });

describe("IdempotentAction", () => {
  it("reuses the key when the same request is resent after a network or server failure", () => {
    const action = new IdempotentAction();
    const first = action.keyFor({ aoi: 1 });
    action.settle(failure(0, "http_network"));
    expect(action.keyFor({ aoi: 1 })).toBe(first);
    action.settle(failure(503));
    expect(action.keyFor({ aoi: 1 })).toBe(first);
    action.settle(new TypeError("Failed to fetch"));
    expect(action.keyFor({ aoi: 1 })).toBe(first);
  });

  it("starts a new action after a success, a 4xx answer, or a changed request", () => {
    const action = new IdempotentAction();
    const first = action.keyFor({ aoi: 1 });
    expect(action.keyFor({ aoi: 2 })).not.toBe(first);
    const second = action.keyFor({ aoi: 2 });
    action.settle();
    const third = action.keyFor({ aoi: 2 });
    expect(third).not.toBe(second); // a deliberate rerun with the same parameters is a new analysis
    action.settle(failure(402, "credits_exhausted"));
    expect(action.keyFor({ aoi: 2 })).not.toBe(third);
  });

  it("produces keys the API accepts", () => {
    expect(new IdempotentAction().keyFor({})).toMatch(/^[A-Za-z0-9_\-:.]{8,128}$/);
  });
});
