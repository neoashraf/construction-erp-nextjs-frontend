import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getRequisitionOutstanding } from "../api/requisition";

/**
 * Outstanding-balance read (`GET /:id/outstanding`; FR-REQ-018/-021). The dedicated read
 * surface for "what remains issuable" — per line + total. Refetched after every issue so the
 * balances update in place. `retry:false` so a `403`/`404` surfaces at once.
 */
export function useRequisitionOutstanding(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("requisitions", "outstanding", id ?? ""),
    queryFn: () => getRequisitionOutstanding(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
