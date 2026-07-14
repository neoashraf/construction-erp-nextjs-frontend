import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getSalarySheet } from "../api/salary";

/**
 * Full salary-sheet fetch (spec §4/§6; FR-HR-013..-014). Includes lines by default so the
 * editor can render totals + per-employee rows. Detail keys are id-scoped (not tenant-scoped)
 * since a sheet id is already company-unique; a company/FY switch invalidates via list
 * queries. `retry:1` — a transient 5xx is worth one retry, but not more (spec §6 error+retry).
 */
export function useSalarySheet(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.detail("hr", "salary-sheet", id ?? "none"), { lines: true }] as const,
    queryFn: () => getSalarySheet(id!, true),
    enabled: !!id && enabled,
    retry: 1,
  });
}
