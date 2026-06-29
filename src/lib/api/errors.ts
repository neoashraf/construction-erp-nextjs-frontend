/**
 * The overview §6 error envelope `{ error: { code, message, details } }` mapped
 * to a typed `ApiError`. Every query/mutation error flows through here so screens
 * render the standard error state (skill §3, §7).
 */

/** Known error codes from overview §6 / the AUD contract (05). Open string for forward-compat. */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "TOKEN_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "OVER_APPROVAL_LIMIT"
  | "NETWORK_ERROR"
  | "UNKNOWN"
  | (string & {});

export interface ApiErrorShape {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown> | null;
  /** HTTP status that carried the error (0 for a transport/network failure). */
  status: number;
}

/** A typed error thrown by the apiClient when the backend (via the BFF) returns a non-2xx. */
export class ApiError extends Error implements ApiErrorShape {
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown> | null;
  readonly status: number;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = "ApiError";
    this.code = shape.code;
    this.details = shape.details ?? null;
    this.status = shape.status;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** True for a deactivated-account / scope / role denial that should not be retried. */
  get isForbidden(): boolean {
    return this.code === "FORBIDDEN";
  }

  /** True when the access token expired — the proxy attempts a refresh before surfacing this. */
  get isTokenExpired(): boolean {
    return this.code === "TOKEN_EXPIRED";
  }

  /** True for validation failures whose `details` map back onto form fields. */
  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR";
  }
}

function isEnvelope(body: unknown): body is { error: { code?: unknown; message?: unknown; details?: unknown } } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "object" &&
    (body as { error: unknown }).error !== null
  );
}

/**
 * Map a raw response body + HTTP status to an `ApiError`. Tolerates a missing or
 * malformed envelope (falls back to UNKNOWN with the status text).
 */
export function toApiError(body: unknown, status: number, statusText = ""): ApiError {
  if (isEnvelope(body)) {
    const { code, message, details } = body.error;
    return new ApiError({
      code: typeof code === "string" && code.length > 0 ? code : "UNKNOWN",
      message: typeof message === "string" && message.length > 0 ? message : statusText || "Request failed",
      details: (details as Record<string, unknown> | null | undefined) ?? null,
      status,
    });
  }
  return new ApiError({
    code: "UNKNOWN",
    message: statusText || "Request failed",
    details: null,
    status,
  });
}

/** Build the ApiError used when the request never reaches the server (offline, DNS, etc.). */
export function networkError(message = "Network request failed"): ApiError {
  return new ApiError({ code: "NETWORK_ERROR", message, details: null, status: 0 });
}

/** Narrow an unknown caught value to ApiError, or wrap it as UNKNOWN. */
export function asApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) {
    return new ApiError({ code: "UNKNOWN", message: err.message, details: null, status: 0 });
  }
  return new ApiError({ code: "UNKNOWN", message: "Unknown error", details: null, status: 0 });
}
