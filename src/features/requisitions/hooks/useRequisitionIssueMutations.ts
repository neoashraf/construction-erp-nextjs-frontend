import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  closeRequisition,
  issueRequisition,
  reverseRequisitionIssue,
  type IssueInput,
} from "../api/requisition";

/**
 * Issue / reverse / close mutations (skill §7; FR-REQ-015/-017/-020). All three are
 * **server-confirmed** — no optimistic UI — because they carry real, irreversible ledger/stock
 * effects (or a one-way close). Each invalidates the requisition detail + its outstanding +
 * issue-history reads so the balances and trail reconcile in place. `retry:false` — these are
 * non-idempotent, ledger-touching writes; a blind retry could double-post.
 */
export function useRequisitionIssueMutations() {
  const qc = useQueryClient();
  const invalidate = (id: string) => {
    qc.invalidateQueries({ queryKey: ["requisitions", "requisition", "list"] });
    qc.invalidateQueries({ queryKey: ["requisitions", "requisition", "detail", id] });
    qc.invalidateQueries({ queryKey: ["requisitions", "outstanding", "detail", id] });
    qc.invalidateQueries({ queryKey: ["requisitions", "issues", "detail", id] });
    qc.invalidateQueries({ queryKey: ["requisitions", "approvals", "detail", id] });
    // On-hand shifts after an issue/reverse — drop the cached badges.
    qc.invalidateQueries({ queryKey: ["requisitions", "on-hand"] });
  };

  const issue = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IssueInput }) => issueRequisition(id, input),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const reverse = useMutation({
    mutationFn: ({
      id,
      issueId,
      reason,
      version,
    }: {
      id: string;
      issueId: string;
      reason: string;
      version: number;
    }) => reverseRequisitionIssue(id, issueId, { reason, version }),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const close = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      closeRequisition(id, { reason, version }),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  return { issue, reverse, close };
}
