import "server-only";
import { redirect } from "next/navigation";
import { getServerSessionWithPermissions } from "./server-session-permissions";
import { guardModule } from "./guard";
import { type ModuleKey } from "./roles";

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
