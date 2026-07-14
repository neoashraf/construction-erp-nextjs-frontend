import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listPayments, type PaymentListFilter } from "../api/payment";

/**
 * Paginated payment list (skill §7). READ-ONLY — this list mutates nothing except the
 * DRAFT hard-delete on a row. Keys are tenant/FY-scoped so a company/FY switch doesn't
 * bleed cached pages. `placeholderData` keeps the previous page visible while a new
 * filter/page loads.
 */
export function usePaymentList(filter: PaymentListFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("payments", "list", scope, { ...filter }),
    queryFn: () => listPayments(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
