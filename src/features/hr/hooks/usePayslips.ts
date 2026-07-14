import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getSheetPayslips, getSalarySheet, type Payslip, type SalarySheet } from "../api/salary";

/**
 * Payslip queries (spec §3/§6; FR-HR-017). We fetch BOTH the parent salary-sheet (for its
 * `status`/`periodLabel`/`entryNo`/`reversalEntryNo`) AND the payslips themselves; the parent
 * fetch drives the not-posted guard (spec §13) and the reversed-run banner (spec §14 flagged
 * behaviour). Both are id-scoped detail keys — a company/FY switch invalidates via the list
 * queries above. `retry:1` matches the sheet editor (transient 5xx worth one retry).
 *
 * `getSheetPayslips` is REUSED from `api/salary.ts` — do NOT create `api/payslip.ts` (brief).
 */

export interface UsePayslipsResult {
  sheet: SalarySheet | undefined;
  payslips: Payslip[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

export function usePayslips(sheetId: string | undefined): UsePayslipsResult {
  const sheetQ = useQuery({
    queryKey: [...queryKeys.detail("hr", "salary-sheet", sheetId ?? "none"), { lines: false }] as const,
    queryFn: () => getSalarySheet(sheetId!, false),
    enabled: !!sheetId,
    retry: 1,
  });

  const status = sheetQ.data?.status;
  const canFetchPayslips = !!sheetId && (status === "POSTED" || status === "REVERSED");

  const payslipsQ = useQuery({
    queryKey: queryKeys.detail("hr", "payslips", sheetId ?? "none"),
    queryFn: () => getSheetPayslips(sheetId!),
    enabled: canFetchPayslips,
    retry: 1,
  });

  return {
    sheet: sheetQ.data,
    payslips: canFetchPayslips ? payslipsQ.data : undefined,
    isLoading: sheetQ.isLoading || (canFetchPayslips && payslipsQ.isLoading),
    isError: sheetQ.isError || (canFetchPayslips && payslipsQ.isError),
    refetch: async () => {
      await sheetQ.refetch();
      if (canFetchPayslips) await payslipsQ.refetch();
    },
  };
}
