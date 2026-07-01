import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFinancialYear,
  updateFinancialYear,
  setActiveFinancialYear,
  type CreateFinancialYearInput,
  type UpdateFinancialYearInput,
} from "../api/financial-years";
import { FINANCIAL_YEARS_KEY } from "./useFinancialYears";

/**
 * Create / edit / set-active mutations for financial years (FR-MAS-002/003).
 * Each invalidates the FY list on success so the table (and the active badge)
 * refresh. `retry: false` — these are non-idempotent writes; a failure must
 * surface (VALIDATION_ERROR / OPTIMISTIC_LOCK_CONFLICT / NOT_FOUND) not silently
 * re-fire. The set-active caller additionally refreshes the shell FY switcher.
 */

export function useCreateFinancialYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFinancialYearInput) => createFinancialYear(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: FINANCIAL_YEARS_KEY }),
    retry: false,
  });
}

export function useUpdateFinancialYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFinancialYearInput }) =>
      updateFinancialYear(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: FINANCIAL_YEARS_KEY }),
    retry: false,
  });
}

export function useSetActiveFinancialYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setActiveFinancialYear(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FINANCIAL_YEARS_KEY }),
    retry: false,
  });
}
