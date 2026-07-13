import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listGrns, type GrnListFilter } from "../api/grns";

/**
 * Paginated GRN list (nextjs-author skill §7). Keys are tenant/FY-scoped so a
 * company / FY switch doesn't bleed cached pages across contexts. `placeholderData`
 * keeps the previous page visible while a new filter/page loads (dimmed via CSS).
 */
export function useGrns(filter: GrnListFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("purchase", "grns", scope, { ...filter }),
    queryFn: () => listGrns(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
