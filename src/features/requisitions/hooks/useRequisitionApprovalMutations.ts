import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveRequisition, rejectRequisition } from "../api/requisition";

/**
 * Approve / reject mutations (skill §7; FR-REQ-008). Both are **server-confirmed** — no
 * optimistic status flip — because the decision drives downstream notifications (Store Keeper
 * on approve) that must not fire speculatively (spec §9). Each invalidates the list + the
 * affected detail so a returning view reconciles to server state. `retry:false` — these are
 * non-idempotent workflow writes.
 */
export function useRequisitionApprovalMutations() {
  const qc = useQueryClient();
  const invalidate = (id: string) => {
    qc.invalidateQueries({ queryKey: ["requisitions", "requisition", "list"] });
    qc.invalidateQueries({ queryKey: ["requisitions", "requisition", "detail", id] });
    qc.invalidateQueries({ queryKey: ["requisitions", "approvals", "detail", id] });
  };

  const approve = useMutation({
    mutationFn: ({ id, note, version }: { id: string; note?: string | null; version: number }) =>
      approveRequisition(id, { note, version }),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      rejectRequisition(id, { reason, version }),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  return { approve, reject };
}
