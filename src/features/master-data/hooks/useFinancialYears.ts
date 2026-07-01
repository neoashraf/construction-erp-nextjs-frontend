import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listFinancialYears, type FinancialYearFilter } from "../api/financial-years";

/** Broad key prefix for all financial-year lists (any filter) — used for invalidation. */
export const FINANCIAL_YEARS_KEY = ["master-data", "financial-years"] as const;

/**
 * The company's financial years (FR-MAS-002/003), scoped by company in the query
 * key so a tenant switch doesn't bleed cache. `filter.isActive` maps to `?isActive`.
 */
export function useFinancialYears(filter: FinancialYearFilter = {}) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list(
      "master-data",
      "financial-years",
      scope,
      filter as Record<string, unknown>,
    ),
    queryFn: () => listFinancialYears(filter),
  });
}
