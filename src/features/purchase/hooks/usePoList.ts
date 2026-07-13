import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listPurchaseOrders, type PurchaseOrderListFilter } from "../api/orders";

/**
 * Paginated PO list (nextjs-author skill §7; FR-PUR-001/-002). Keys are tenant/FY-scoped so
 * a company or FY switch doesn't bleed a cached page across contexts. `placeholderData`
 * keeps the previous page visible while a new filter/page loads (the list dims via CSS in
 * the parent, spec §6).
 */
export function usePurchaseOrders(filter: PurchaseOrderListFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("purchase", "orders", scope, { ...filter }),
    queryFn: () => listPurchaseOrders(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
