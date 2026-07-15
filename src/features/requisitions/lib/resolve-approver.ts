import { type ProjectOption, type UserOption } from "../types";

export interface ApproverPreview {
  /** The assigned PM's display name, when resolvable — absent when no PM is assigned. */
  name: string | null;
  label: string;
}

/**
 * A read-only, client-derived preview of who is likely to approve this requisition — never
 * submitted to the API. There is no "named approver" concept in the backend: `approvalTier`
 * (PM vs ACCOUNTS) is a pure estimated-value-vs-threshold decision resolved only at submit, and
 * the PM-tier threshold is never exposed to the client (SRS §5.2 FR-REQ-009; API contract 09
 * §submit). The only named per-project role that already exists is the project's assigned PM
 * (`ProjectOption.projectManagerId`, MAS). So this shows that PM's name, honestly caveated as
 * "if within PM limit" rather than asserting a tier the client can't know yet — correct whenever
 * the requisition ends up in the PM tier, and clear that it might still escalate to Accounts.
 */
export function resolveApprover(
  project: ProjectOption | undefined,
  users: UserOption[],
): ApproverPreview | null {
  if (!project) return null;
  const pm = project.projectManagerId ? users.find((u) => u.id === project.projectManagerId) : undefined;
  if (!pm) return { name: null, label: "Approver depends on estimated value" };
  return { name: pm.name, label: "approver if within PM limit" };
}
