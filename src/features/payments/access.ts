import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * Payments (PAY) scope predicates (brief fe-payment-list §Scope 11; spec §11). Accounts
 * Manager + Admin see all company payments + all open payables (full list · outstanding ·
 * new · delete-draft · post · cancel). Project Manager **never sees this screen**. The
 * server re-checks (`payment:read`/`payment:write`/`payment:post`/`payment:cancel`)
 * regardless of what the UI shows — hidden affordances are UX, never the gate.
 */
export const PAYMENT_RESOURCE = "payments.list";

/**
 * The Outstanding view's own nav resource (`/payments/open-payables`). Two nav entries,
 * ONE screen — READ-only, so it can be granted independently of `payments.list` while
 * every write stays on that one (nav-tree-admin.md "Two nav entries, one screen").
 */
export const OPEN_PAYABLES_RESOURCE = "payments.open_payables";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allowOn(
  user: Viewer,
  resource: string,
  action: ActionCode,
  fallbackRoles: readonly Role[],
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, resource, action);
  return roleMatches(fallbackRoles, user.role);
}

function allow(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  return allowOn(user, PAYMENT_RESOURCE, action, fallbackRoles);
}

/** Read the list / open a payment (`payments.list:READ` — server backstop `payment:read`). */
export function canReadPayment(user: Viewer): boolean {
  return allow(user, "READ", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}

/**
 * Open the Outstanding view / its own route (`payments.open_payables:READ` — server
 * backstop `payment:read`). An actor granted only this sees only that nav entry, and the
 * segmented control hides the tab it may not open (spec §6, §11).
 */
export function canReadOpenPayables(user: Viewer): boolean {
  return allowOn(user, OPEN_PAYABLES_RESOURCE, "READ", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}

/** "New payment" CTA + row Delete-draft (`payments.list:CREATE`/`UPDATE`). */
export function canWritePayment(user: Viewer): boolean {
  return allow(user, "CREATE", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}

/** Post a draft payment (`payments.list:POST`). Draft Save still works without it. */
export function canPostPayment(user: Viewer): boolean {
  return allow(user, "POST", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}

/** Cancel/repost a posted payment (`payments.list:CANCEL`). PM never. */
export function canCancelPayment(user: Viewer): boolean {
  return allow(user, "CANCEL", ["ACCOUNTS_TEAM", "ACCOUNTS_MANAGER"]);
}
