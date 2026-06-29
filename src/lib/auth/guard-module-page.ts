import "server-only";
import { redirect } from "next/navigation";
import { getServerSession } from "./server-session";
import { guardModule } from "./guard";
import { type ModuleKey } from "./roles";

/**
 * Server-side module route guard (skill §5). A module segment page calls this; a
 * role lacking the module is redirected to /403, an unauthenticated visitor to
 * /login. Defence-in-depth — the backend still enforces RBAC.
 */
export async function requireModuleAccess(module: ModuleKey): Promise<void> {
  const user = await getServerSession();
  const decision = guardModule(user?.role, module);
  if (!decision.allow) {
    redirect(decision.redirectTo);
  }
}
