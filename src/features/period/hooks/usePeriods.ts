import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listPeriods, listFinancialYearOptions } from "../api";

/**
 * PER query hooks (skill §7). Keys are namespaced + tenant/FY-scoped so a
 * company/FY switch doesn't bleed cache. Reads are always within one FY —
 * `usePeriods` is `enabled` only once a `financialYearId` is chosen.
 */

export const PERIODS_KEY = ["period", "periods"] as const;

/** The financial years for the in-page selector (spec §3/§7; MAS-owned). */
export function useFinancialYearOptions() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("period", "financial-years", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: listFinancialYearOptions,
  });
}

/** The selected FY's periods, ordered by `startDate` asc (server-ordered, FR-PER-001). */
export function usePeriods(financialYearId: string | null) {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list(
      "period",
      "periods",
      { companyId: user.companyId, financialYearId: user.financialYearId },
      { selectedFinancialYearId: financialYearId },
    ),
    queryFn: () => listPeriods(financialYearId as string),
    enabled: !!financialYearId,
  });
}

/** Invalidate every cached periods list (after generate/close/reopen/close-fy). */
export function useInvalidatePeriods() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PERIODS_KEY });
}
