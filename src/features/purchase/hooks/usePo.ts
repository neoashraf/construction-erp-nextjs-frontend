import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getPurchaseOrder } from "../api/orders";

/**
 * Single Purchase Order read (nextjs-author skill §7; FR-PUR-001/-002/-024). `retry:false`
 * so a `403`/`404` surfaces at once — the editor renders permission-denied / not-found.
 * A `null` id (the `/purchase/orders/new` route) leaves the query disabled; the editor
 * starts from a blank draft.
 */
export function usePurchaseOrder(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("purchase", "order", id ?? ""),
    queryFn: () => getPurchaseOrder(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
