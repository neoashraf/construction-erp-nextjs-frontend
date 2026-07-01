import { useMutation } from "@tanstack/react-query";
import { generatePeriods, closePeriod, reopenPeriod, closeFinancialYear } from "../api";
import { useInvalidatePeriods } from "./usePeriods";

/**
 * PER action mutations (spec §9; FR-PER-002/008/009/010). Every action is
 * server-confirmed — no optimistic flip; the caller re-renders from the
 * response/invalidation only after a 2xx. `retry: false` — these are not
 * idempotent to blind-retry (a close retried after a network blip could double
 * up on an already-processed request; the confirm dialog UX is a manual retry).
 */

/** Generate the standard monthly set for an FY (Admin, `period.generate`, FR-PER-002). */
export function useGeneratePeriods() {
  const invalidate = useInvalidatePeriods();
  return useMutation({
    mutationFn: (financialYearId: string) => generatePeriods(financialYearId),
    onSuccess: () => invalidate(),
    retry: false,
  });
}

/** Close one OPEN period (Accounts Team / Admin, `period.close`, FR-PER-008). */
export function useClosePeriod() {
  const invalidate = useInvalidatePeriods();
  return useMutation({
    mutationFn: (id: string) => closePeriod(id),
    onSuccess: () => invalidate(),
    retry: false,
  });
}

/** Reopen one CLOSED period (Admin only, `period.reopen`, FR-PER-009). */
export function useReopenPeriod() {
  const invalidate = useInvalidatePeriods();
  return useMutation({
    mutationFn: (id: string) => reopenPeriod(id),
    onSuccess: () => invalidate(),
    retry: false,
  });
}

/** Close every remaining OPEN period of the FY (Admin, `period.close`, FR-PER-010). */
export function useCloseFinancialYear() {
  const invalidate = useInvalidatePeriods();
  return useMutation({
    mutationFn: (financialYearId: string) => closeFinancialYear(financialYearId),
    onSuccess: () => invalidate(),
    retry: false,
  });
}
