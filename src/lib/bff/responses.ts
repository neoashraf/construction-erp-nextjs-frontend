import { NextResponse } from "next/server";

/** Build a §6 error-envelope JSON response with the given HTTP status. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> | null = null,
): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/** True for an upstream body that is already a §6 error envelope. */
export function isErrorEnvelope(body: unknown): body is { error: { code: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { code?: unknown } }).error?.code === "string"
  );
}

/** Read the error code from an upstream body, or "" if it isn't an envelope. */
export function upstreamErrorCode(body: unknown): string {
  return isErrorEnvelope(body) ? body.error.code : "";
}
