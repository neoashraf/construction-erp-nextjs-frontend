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
  | "adminLockout"
  | "duplicateRoleName"
  | "systemRoleImmutable"
  | "roleInUse"
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
const ADMIN_LOCKOUT_MESSAGE = "The Admin role must keep full access.";
const DUPLICATE_ROLE_NAME_MESSAGE = "A role with this name already exists.";
const SYSTEM_ROLE_IMMUTABLE_MESSAGE = "Built-in roles can't be renamed or deleted.";
const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";
const LOAD_ERROR_MESSAGE = "Couldn't load roles & permissions.";

/** Map a save/CRUD-time server error to the exact spec §8 banner/toast string. */
export function mapRolePermissionError(err: ApiError): MappedRolePermissionError {
  switch (err.code) {
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { kind: "optimisticLockConflict", message: CONFLICT_MESSAGE };
    case "ROLE_SCOPE_CONFLICT":
      return { kind: "roleScopeConflict", message: SCOPE_CLASH_MESSAGE };
    case "ADMIN_LOCKOUT_FORBIDDEN":
      return { kind: "adminLockout", message: ADMIN_LOCKOUT_MESSAGE };
    case "DUPLICATE_ROLE_NAME":
      return { kind: "duplicateRoleName", message: DUPLICATE_ROLE_NAME_MESSAGE };
    case "SYSTEM_ROLE_IMMUTABLE":
      return { kind: "systemRoleImmutable", message: SYSTEM_ROLE_IMMUTABLE_MESSAGE };
    case "ROLE_IN_USE":
      return { kind: "roleInUse", message: "Reassign the users holding this role before deleting." };
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

/** Delete-role guard copy (spec §8): ROLE_IN_USE names the count; SYSTEM immutability. */
export function roleInUseMessage(userCount: number): string {
  return `This role is assigned to ${userCount} user${userCount === 1 ? "" : "s"}. Reassign them before deleting.`;
}

export {
  CONFLICT_MESSAGE,
  SCOPE_CLASH_MESSAGE,
  ADMIN_LOCKOUT_MESSAGE,
  DUPLICATE_ROLE_NAME_MESSAGE,
  SYSTEM_ROLE_IMMUTABLE_MESSAGE,
  OFFLINE_MESSAGE,
  LOAD_ERROR_MESSAGE,
};
