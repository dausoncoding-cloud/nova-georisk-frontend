import type { components } from "./generated/nova-browser-api";

type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    requestId?: string | null;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId ?? null;
    this.details = options.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

export function toApiError(response: Response, payload: unknown): ApiError {
  if (isErrorEnvelope(payload)) {
    return new ApiError({
      status: response.status,
      code: payload.error.code,
      message: payload.error.message,
      requestId: payload.error.request_id ?? response.headers.get("X-Request-Id"),
      details: payload.error.details,
    });
  }

  return new ApiError({
    status: response.status,
    code: `http_${response.status || "network"}`,
    message:
      response.status >= 500
        ? "NOVA is temporarily unavailable. Please try again."
        : "The request could not be completed.",
    requestId: response.headers.get("X-Request-Id"),
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

type ValidationDetail = { loc?: unknown[]; msg?: string };

/**
 * Plain message for an API error. A 422 validation error names its fields in `details`; this turns them into a
 * specific sentence instead of the envelope's generic "One or more request fields are invalid." (r5.1).
 */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError && error.code === "validation_error" && Array.isArray(error.details) && error.details.length) {
    const messages = (error.details as ValidationDetail[]).map((detail) => {
      const path = (detail.loc ?? []).filter((part) => part !== "body").map(String);
      const message = (detail.msg ?? "").replace(/^Value error, /, "");
      if (path.includes("products")) return "Select at least one product (step 4).";
      if (/Baseline must precede target/i.test(message)) return "The baseline must end before the target starts; the two windows may not overlap.";
      return path.length ? `${path.join(" › ")}: ${message}` : message;
    });
    return [...new Set(messages.filter(Boolean))].join(" ");
  }
  return getErrorMessage(error);
}
