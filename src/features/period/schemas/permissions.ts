import { type Role } from "@/lib/auth/roles";

/**
 * Role -> PER capability map (screen spec §11; SRS §3). Single role per user
 * (skill §5). This is a UI affordance map only — defence-in-depth; the server
 * re-checks every call and returns `403 FORBIDDEN` if forged.
 *
 *   Admin         — period.generate + period.close + period.reopen
 *   Accounts Team — period.close only (no reopen, no generate)
 *   everyone else — read-only (no per-row action, no toolbar action)
 */
export interface PeriodCapabilities {
  canGenerate: boolean;
  canClose: boolean;
  canReopen: boolean;
}

export function periodCapabilities(role: Role): PeriodCapabilities {
  switch (role) {
    case "ADMIN":
      return { canGenerate: true, canClose: true, canReopen: true };
    case "ACCOUNTS_TEAM":
      return { canGenerate: false, canClose: true, canReopen: false };
    default:
      return { canGenerate: false, canClose: false, canReopen: false };
  }
}
