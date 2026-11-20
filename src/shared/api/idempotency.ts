import { ApiError } from "./errors";

/**
 * One Idempotency-Key per user action (a click on Run or Retry), so a resent request never creates a
 * second analysis or a second credit charge.
 *
 * The key is reused only when the *same* request is sent again after it may not have reached the server
 * (a network error or a 5xx). A success or a 4xx answer ends the action; the next click is a new
 * analysis with a new key, even with identical parameters.
 */
export class IdempotentAction {
  private pending: { key: string; request: string } | null = null;

  keyFor(request: unknown): string {
    const serialized = JSON.stringify(request ?? null);
    if (this.pending?.request !== serialized) {
      this.pending = { key: newKey(), request: serialized };
    }
    return this.pending.key;
  }

  settle(error?: unknown): void {
    if (error === undefined || !mayNotHaveArrived(error)) this.pending = null;
  }
}

function mayNotHaveArrived(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500 || error.code === "http_network";
}

function newKey(): string {
  return `nova-${globalThis.crypto.randomUUID()}`;
}
