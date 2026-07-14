import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * Contra & Journal (GEN) scope predicates (brief FE-48 §11). Accounts + Admin see + edit;
 * no other role reaches this screen. Server re-checks (`contra:read`, `journal:read`,
 * `contra:write`, `journal:write`) regardless of what the UI shows — hidden affordances
 * are UX, never the gate.
 */
export const CJ_RESOURCE = "contra_journal.vouchers";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allow(user: Viewer, action: ActionCode, fallback: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, CJ_RESOURCE, action);
  return roleMatches(fallback, user.role);
}

export function canReadVoucher(user: Viewer): boolean {
  return allow(user, "READ", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}
export function canWriteVoucher(user: Viewer): boolean {
  return allow(user, "CREATE", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}
