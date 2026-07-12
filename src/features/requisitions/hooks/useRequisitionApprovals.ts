import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { listRequisitionApprovals } from "../api/requisition";

/**
 * Approval-history read (`GET /:id/approvals`; FR-REQ-008). The review screen decides from
 * the requisition itself; the full decision trail (each approve/reject with tier + threshold)
 * lives on the issue screen's status trail ("View history"). This hook backs any inline
 * drill that needs the recorded decisions. `retry:false` so a `403`/`404` surfaces at once.
 */
export function useRequisitionApprovals(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("requisitions", "approvals", id ?? ""),
    queryFn: () => listRequisitionApprovals(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
