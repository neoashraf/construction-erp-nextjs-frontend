import { z } from "zod";
import { type ApiError } from "@/lib/api/errors";

/**
 * Project-assignment validation (spec §7; SRS §11 — a scoped user needs >= 1
 * project to transact) + server-error mapping (spec §8 exact strings). The
 * pending set is a plain `string[]` of project ids; dedupe happens client-side
 * before it ever reaches the schema (spec §6 "duplicates deduped client-side").
 */

export const EMPTY_SELECTION_MESSAGE = "Select at least one project.";

/** Dedupe a list of project ids, preserving first-seen order. */
export function dedupeProjectIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

/** Non-empty, deduped `projectIds` — the shape of the `PUT` body's payload (spec §9). */
export const projectIdsSchema = z
  .array(z.string())
  .transform((ids) => dedupeProjectIds(ids))
  .refine((ids) => ids.length > 0, { message: EMPTY_SELECTION_MESSAGE });

/** True when the pending set fails validation (empty after dedupe) — drives the inline save-bar message. */
export function isEmptySelection(ids: string[]): boolean {
  return dedupeProjectIds(ids).length === 0;
}

// ── Server-error mapping (spec §6/§8) ───────────────────────────────────────

export type ProjectAssignmentErrorKind =
  "validation" | "roleScopeConflict" | "notFound" | "forbidden" | "offline" | "unknown";

export interface MappedProjectAssignmentError {
  kind: ProjectAssignmentErrorKind;
  message: string;
}

export const ASSIGNMENT_LOAD_ERROR_MESSAGE = "Couldn't load assigned projects.";
export const ASSIGNMENT_SCOPE_CLASH_MESSAGE =
  "This role applies to all projects, so individual projects can't be assigned.";
export const ASSIGNMENT_NOT_FOUND_MESSAGE = "That project no longer exists in this company.";
export const ASSIGNMENT_FORBIDDEN_MESSAGE = "You don't have access to project assignment.";
export const ASSIGNMENT_OFFLINE_MESSAGE =
  "Can't reach the server. Check your connection and try again.";
export const SUCCESS_MESSAGE = "Project assignments updated.";

/** Map a load/save-time server error to the exact spec §8 banner/toast string. */
export function mapProjectAssignmentError(err: ApiError): MappedProjectAssignmentError {
  switch (err.code) {
    case "VALIDATION_ERROR":
      return { kind: "validation", message: EMPTY_SELECTION_MESSAGE };
    case "ROLE_SCOPE_CONFLICT":
      return { kind: "roleScopeConflict", message: ASSIGNMENT_SCOPE_CLASH_MESSAGE };
    case "NOT_FOUND":
      return { kind: "notFound", message: ASSIGNMENT_NOT_FOUND_MESSAGE };
    case "FORBIDDEN":
      return { kind: "forbidden", message: ASSIGNMENT_FORBIDDEN_MESSAGE };
    case "NETWORK_ERROR":
      return { kind: "offline", message: ASSIGNMENT_OFFLINE_MESSAGE };
    default:
      return { kind: "unknown", message: err.message || ASSIGNMENT_LOAD_ERROR_MESSAGE };
  }
}
