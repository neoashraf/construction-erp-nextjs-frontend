/**
 * Session-lost navigation. When a live session ends client-side — the refresh
 * token is truly expired/revoked and the BFF returns 401 with cookies cleared —
 * the app must send the user to login instead of freezing on the shell skeleton
 * (`!user → <ShellSkeleton/>`). A hard navigation (not the app router) is
 * deliberate: it tears down in-flight shell/query state, and the (auth) route
 * group renders without the shell. `?expired=1` lets the login screen explain why.
 * No-ops on the server and when already on an (auth) screen.
 */
export const LOGIN_EXPIRED_PATH = "/login?expired=1";

export function navigateToLoginExpired(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  // Already on login / change-password (the (auth) group) — nothing to do.
  if (path.startsWith("/login") || path.startsWith("/change-password")) return;
  window.location.assign(LOGIN_EXPIRED_PATH);
}
