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
