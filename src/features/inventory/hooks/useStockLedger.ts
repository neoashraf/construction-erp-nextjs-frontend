import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listStockLedger, type StockLedgerFilter } from "../api/stock-ledger";

/**
 * Stock-ledger balances hook (skill §7; FR-INV-001/021). Tenant + as-of scoped keys so a
 * company/FY switch or an as-of-date change refetches without cache bleed; `keepPreviousData`
 * keeps the table visible (dimmed) while a filter reloads. The server scopes PM/Store Keeper
 * to assigned projects' godowns; a direct out-of-scope filter surfaces as `403`.
 */
export function useStockLedger(filter: StockLedgerFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("inventory", "stock-ledger", scope, filter as Record<string, unknown>),
    queryFn: () => listStockLedger(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}
