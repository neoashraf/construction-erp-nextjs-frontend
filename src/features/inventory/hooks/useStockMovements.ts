import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listStockMovements, type StockMovementFilter } from "../api/stock-ledger";

/**
 * Movement-history hook (skill §7; FR-INV-004/006/021). Enabled only once the panel is
 * open with both `godownId` + `itemId` (the endpoint requires them). `retry:false` so a
 * `403`/`400` surfaces at once in the panel; the balances table behind it stays
 * interactive (independent error state, spec §6). Newest-first sort is applied client-side.
 */
export function useStockMovements(filter: StockMovementFilter | null) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  const enabled = Boolean(filter?.godownId && filter?.itemId);
  return useQuery({
    queryKey: queryKeys.list(
      "inventory",
      "stock-movements",
      scope,
      (filter ?? {}) as Record<string, unknown>,
    ),
    queryFn: () => listStockMovements(filter as StockMovementFilter),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
