import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * Receipts (REC) scope predicates (brief fe-receipt-list §Scope 9; spec §11). Accounts
 * Manager + Admin see all company receipts (both types, all statuses) with "New receipt"
 * + row "Print"; Project Manager is read-only on assigned-project rows (general no-project
 * receipts excluded server-side) — no "New receipt", no edit/post/cancel/print. The server
 * re-checks (`receipt:read`/`receipt:write`/`receipt:post`/`receipt:cancel`) regardless of
 * what the UI shows — hidden affordances are UX, never the gate.
 */
export const RECEIPT_RESOURCE = "receipts";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allow(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, RECEIPT_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** "New receipt" CTA + row Edit (`receipt:write`; catalogue C/U). */
export function canWriteReceipt(user: Viewer): boolean {
  return allow(user, "CREATE", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}

/** Row "Print" on a posted receipt (`receipt:post` gates the posting surface it routes to). */
export function canPrintReceipt(user: Viewer): boolean {
  return allow(user, "POST", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}
