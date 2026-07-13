import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getPurchaseBill } from "../api/bills";

/**
 * Single Purchase Bill read (nextjs-author skill §7). `retry:false` so a `403`/`404`
 * surfaces at once — the editor/viewer renders permission-denied / not-found. A `null`
 * id (the `/purchase/bills/new` route) leaves the query disabled; the editor starts
 * from a blank draft.
 */
export function usePurchaseBill(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("purchase", "bill", id ?? ""),
    queryFn: () => getPurchaseBill(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
