import { CSRF_COOKIE } from "./session";

/**
 * Read the double-submit CSRF token from the readable `ze_csrf` cookie (client
 * side) so it can be echoed in the `x-csrf-token` header on state-changing
 * requests (skill §4). The auth tokens themselves are httpOnly and NOT readable —
 * only this CSRF token is.
 */
export function readCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}
