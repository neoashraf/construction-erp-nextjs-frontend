import { useQuery } from "@tanstack/react-query";
import { getStockBalance } from "../api/stock-balance";

/**
 * Per-(godown, item) on-hand snapshot behind the GRN line's badge (brief §Scope 4;
 * spec §5/§9). Read from the shared INV stock-ledger — informational only, never a
 * validation gate (Phase 1 has no negative-stock rule on a receipt-in per se; a rare
 * `NEGATIVE_STOCK` surfaces generically at Post). Disabled until both ids are set;
 * a short `staleTime` so the badge stays "live" without hammering the endpoint.
 */
export function useOnHand(godownId: string, itemId: string) {
  return useQuery({
    queryKey: ["inventory", "stock-balance", godownId, itemId],
    queryFn: () => getStockBalance(godownId, itemId),
    enabled: !!godownId && !!itemId,
    staleTime: 30_000,
    retry: false,
  });
}
