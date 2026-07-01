import { z } from "zod";
import { isNonNegativeMoney } from "@/lib/money";
import { type ApiError } from "@/lib/api/errors";

/**
 * Role & permission editor validation (spec §7; SRS §11 `approval_limit`/
 * `value_limit` >= 0, `Decimal(18,4)`). Limits are optional decimal strings —
 * empty/null means escalate-by-default ("No approval authority" / "Role limit"),
 * never zero and never a JS float (skill §0.2).
 */

const LIMIT_MESSAGE = "Enter an amount of 0 or more.";

/** A limit field: empty string/undefined = no limit (valid); otherwise must be Decimal(18,4) >= 0. */
export const limitSchema = z
  .string()
  .optional()
  .refine((v) => v === undefined || v.trim() === "" || isNonNegativeMoney(v), {
    message: LIMIT_MESSAGE,
  });

/** True when a raw limit input string is invalid (used for inline field state, spec §7). */
export function isInvalidLimit(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return !isNonNegativeMoney(trimmed);
}

/** Normalise a raw limit input to the wire form: "" -> null, else the trimmed decimal string. */
export function normaliseLimit(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export const LIMIT_VALIDATION_MESSAGE = LIMIT_MESSAGE;

// ── Server-error mapping (spec §6/§8) ───────────────────────────────────────

export type RolePermissionErrorKind =
  | "validation"
  | "optimisticLockConflict"
  | "roleScopeConflict"
  | "duplicatePermission"
  | "forbidden"
  | "offline"
  | "notFound"
  | "unknown";

export interface MappedRolePermissionError {
  kind: RolePermissionErrorKind;
  message: string;
}

const CONFLICT_MESSAGE =
  "This role was changed by someone else. Reload to see the latest, then reapply your changes.";
const SCOPE_CLASH_MESSAGE =
  "This role applies to all projects, so project scope can't be restricted.";
const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";
const LOAD_ERROR_MESSAGE = "Couldn't load this role.";

/** Map a save-time server error to the exact spec §8 banner/toast string. */
export function mapRolePermissionError(err: ApiError): MappedRolePermissionError {
  switch (err.code) {
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { kind: "optimisticLockConflict", message: CONFLICT_MESSAGE };
    case "ROLE_SCOPE_CONFLICT":
      return { kind: "roleScopeConflict", message: SCOPE_CLASH_MESSAGE };
    case "DUPLICATE_PERMISSION":
      // Reconciled silently as "on" by the caller — this message is a fallback only.
      return { kind: "duplicatePermission", message: "That permission is already granted." };
    case "VALIDATION_ERROR":
      return { kind: "validation", message: LIMIT_MESSAGE };
    case "FORBIDDEN":
      return { kind: "forbidden", message: "You don't have access to roles & permissions." };
    case "NOT_FOUND":
      return { kind: "notFound", message: LOAD_ERROR_MESSAGE };
    case "NETWORK_ERROR":
      return { kind: "offline", message: OFFLINE_MESSAGE };
    default:
      return { kind: "unknown", message: err.message || LOAD_ERROR_MESSAGE };
  }
}

export { CONFLICT_MESSAGE, SCOPE_CLASH_MESSAGE, OFFLINE_MESSAGE, LOAD_ERROR_MESSAGE };
