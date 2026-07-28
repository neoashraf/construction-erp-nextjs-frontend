import "server-only";
import { redirect } from "next/navigation";
import { getServerSessionWithPermissions } from "./server-session-permissions";
import { guardModule, FORBIDDEN_PATH } from "./guard";
import { type ModuleKey } from "./roles";
import { type SafeUser } from "./session";

/**
 * Server-side **resource** route guard — for a module that owns more than one nav entry,
 * where a route needs its own `(resource, action)` beyond module access. The caller
 * supplies the feature's own predicate (e.g. `canReadOpenPayables`) so the resource code
 * and its degraded-session role fallback stay in one place — that module's `access.ts`.
 *
 * Checks module access first, then the resource, redirecting to /login or /403. Hiding
 * the affordance in the UI is never the gate; this is, and the backend re-checks again.
 */
export async function requireResourceAccess(
  module: ModuleKey,
  allows: (user: SafeUser) => boolean,
): Promise<void> {
  const user = await getServerSessionWithPermissions();
  const moduleDecision = guardModule(user, module);
  if (!moduleDecision.allow) {
    redirect(moduleDecision.redirectTo);
  }
  // `user` is non-null here — guardModule rejects an absent viewer as unauthenticated.
  if (!allows(user as SafeUser)) {
    redirect(FORBIDDEN_PATH);
  }
}

/**
 * Server-side module route guard (skill §5). A module segment page calls this; a
 * role lacking the module is redirected to /403, an unauthenticated visitor to
 * /login. Defence-in-depth — the backend still enforces RBAC.
 */
export async function requireModuleAccess(module: ModuleKey): Promise<void> {
  // FE-21: use the permission-ENRICHED session (backend /auth/me projection) so the
  // guard is permission-driven — a custom grant (e.g. HR Manager given the Audit
  // module) admits the page. It degrades to the cookie-only session (role-map
  // fallback) when the projection is unavailable. The backend re-checks the exact
  // grant on every call regardless (defence-in-depth).
  const user = await getServerSessionWithPermissions();
  const decision = guardModule(user, module);
  if (!decision.allow) {
    redirect(decision.redirectTo);
  }
}
