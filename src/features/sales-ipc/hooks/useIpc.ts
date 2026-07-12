import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getIpc } from "../api/ipc";

/**
 * Single-IPC read (skill §7; FR-SAL-002/-004). `retry:false` so a `403`/`404` surfaces at once
 * (the editor renders the permission-denied / not-found state). A `null` id (the `"new"` route)
 * leaves it disabled — the editor starts from a blank draft.
 */
export function useIpc(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("sales-ipc", "ipc", id ?? ""),
    queryFn: () => getIpc(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
