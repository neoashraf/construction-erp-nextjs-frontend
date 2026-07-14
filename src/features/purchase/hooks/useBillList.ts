import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listPurchaseBills, type PurchaseBillListFilter } from "../api/bills";

/**
 * Paginated Purchase Bill list (nextjs-author skill §7). Keys are tenant/FY-scoped so a
 * company or FY switch doesn't bleed a cached page across contexts. `placeholderData`
 * keeps the previous page visible while a new filter/page loads (the list dims via CSS
 * in the parent, per spec §6).
 */
export function usePurchaseBills(filter: PurchaseBillListFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("purchase", "bills", scope, { ...filter }),
    queryFn: () => listPurchaseBills(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
