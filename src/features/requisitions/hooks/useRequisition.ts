import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getRequisition } from "../api/requisition";

/**
 * Single-requisition read (skill §7; FR-REQ-022). `retry:false` so a `403`/`404` surfaces at
 * once (the entry form / viewer renders the permission-denied / not-found state). `null` id
 * (the `"new"` route) leaves it disabled — the form starts from a blank draft.
 */
export function useRequisition(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("requisitions", "requisition", id ?? ""),
    queryFn: () => getRequisition(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
