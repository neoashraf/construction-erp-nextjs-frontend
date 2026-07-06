/**
 * Forced-change navigation (FR-AUD-030, app-shell §13). While the user is on a
 * temporary/reset password the client holds them on the change-password screen in
 * forced mode. A hard navigation (not the app router) is deliberate: it tears down
 * any in-flight shell state and the (auth) route group renders without the shell.
 * No-ops on the server and when already on the change-password screen.
 */
export const FORCED_CHANGE_PATH = "/change-password?forced=1";

export function navigateToForcedChange(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/change-password")) return;
  window.location.assign(FORCED_CHANGE_PATH);
}
