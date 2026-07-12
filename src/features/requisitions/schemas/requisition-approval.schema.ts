import { z } from "zod";
import { hasGrant, roleMatches } from "@/lib/auth/roles";
import { type SafeUser } from "@/lib/auth/session";
import { REQ_APPROVALS_RESOURCE } from "../access";
import { type ApprovalTier, type Requisition } from "../types";

/**
 * Requisition-review decision helpers (spec §7/§8/§9; FR-REQ-008…-011). The review screen
 * writes NO ledger line — the only lifecycle move is the workflow transition
 * `SUBMITTED → APPROVED | REJECTED`. This module owns the reject-reason schema, the exact
 * spec §8 error copy, and the **client-side authority computation** (tier + role + project
 * scope) that decides whether the action bar is enabled. The server re-validates every
 * action regardless (`APPROVAL_BEYOND_AUTHORITY` / `REQUISITION_NOT_SUBMITTED`).
 */

/** Reject requires a non-empty reason (FR-REQ-008; `MISSING_REJECT_REASON`). */
export const rejectReasonSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason for rejecting this requisition."),
});
export type RejectReasonValues = z.infer<typeof rejectReasonSchema>;

/** Why the action bar is disabled, when it is. */
export type ApprovalBlockReason = "escalated" | "already-decided" | "not-authorised";

export type ApprovalAuthority =
  | { canDecide: true; tier: ApprovalTier }
  | { canDecide: false; reason: ApprovalBlockReason; tier: ApprovalTier | null };

type Viewer = Pick<SafeUser, "role" | "permissions" | "assignedProjectIds" | "projectScope">;

/** A project-scoped viewer is bound to a project only when we actually hold the scope data. */
function assignedToProject(user: Viewer, projectId: string): boolean {
  if (user.role === "ADMIN") return true;
  if (user.projectScope === "ALL") return true;
  if (user.projectScope && typeof user.projectScope === "object") {
    return user.projectScope.projectIds.includes(projectId);
  }
  if (user.assignedProjectIds && user.assignedProjectIds.length > 0) {
    return user.assignedProjectIds.includes(projectId);
  }
  // No scope projection: rely on the server, which already scoped the read to this project.
  return true;
}

/** True when the effective set (or the role fallback) grants approve/reject on this resource. */
function hasDecideGrant(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user, REQ_APPROVALS_RESOURCE, "APPROVE");
  return roleMatches(["PROJECT_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"], user.role);
}

/**
 * Resolve whether `user` may Approve/Reject `requisition` right now, and — when not — why,
 * so the UI can render the escalated note, the already-decided banner, or a plain read-only
 * view (spec §6/§9/§11; escalate-by-default, FR-REQ-010/-011). Accounts is the escalation
 * authority only — it has NO decision control on a PM-tier requisition (Open items).
 */
export function resolveApprovalAuthority(
  user: Viewer,
  requisition: Requisition,
): ApprovalAuthority {
  const tier = requisition.approvalTier;
  if (requisition.status !== "SUBMITTED") {
    return { canDecide: false, reason: "already-decided", tier };
  }
  if (user.role === "ADMIN") return { canDecide: true, tier: tier ?? "PM" };
  if (!hasDecideGrant(user)) return { canDecide: false, reason: "not-authorised", tier };

  const isPM = roleMatches(["PROJECT_MANAGER"], user.role);
  const isAccounts = roleMatches(["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"], user.role);

  if (tier === "ACCOUNTS") {
    if (isAccounts) return { canDecide: true, tier };
    if (isPM) return { canDecide: false, reason: "escalated", tier };
    return { canDecide: false, reason: "not-authorised", tier };
  }
  // PM tier (or an unresolved tier treated as PM).
  if (isPM) {
    return assignedToProject(user, requisition.projectId)
      ? { canDecide: true, tier: tier ?? "PM" }
      : { canDecide: false, reason: "not-authorised", tier: tier ?? "PM" };
  }
  // Accounts (or any other reviewer) viewing a PM-tier requisition: view only, no control.
  return { canDecide: false, reason: "not-authorised", tier: tier ?? "PM" };
}

/**
 * Map a decision (approve/reject) error code to its exact spec §8 copy. `raced` flags the
 * already-decided race (the caller refreshes to read-only); `field` scopes the empty-reason
 * message to the reject field; the rest render as the inline decision-failure banner.
 */
export function mapApprovalError(code: string): {
  message: string;
  field?: "reason";
  raced?: boolean;
} {
  switch (code) {
    case "MISSING_REJECT_REASON":
      return { field: "reason", message: "Enter a reason for rejecting this requisition." };
    case "REQUISITION_NOT_SUBMITTED":
      return { message: "This requisition has already been decided.", raced: true };
    case "APPROVAL_BEYOND_AUTHORITY":
      return {
        message:
          "This requisition is above your approval limit — it has been escalated to Accounts.",
      };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return {
        message: "This requisition was just changed by someone else. Refresh and try again.",
        raced: true,
      };
    case "FORBIDDEN":
      return { message: "You don't have permission to review this requisition." };
    default:
      return { message: "Couldn't record your decision. Please try again." };
  }
}
