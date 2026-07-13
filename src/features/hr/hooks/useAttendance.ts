import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listAttendance, type AttendanceListFilter } from "../api/attendance";

/**
 * Attendance list hook — one page per mode/date/project (FR-HR-004..-008). Tenant-scoped
 * keys; `keepPreviousData` keeps the visible grid dimmed while the mode/date changes.
 * PM/Site-Engineer project-scope is server-enforced (403 on out-of-scope projectId).
 */
export function useAttendance(filter: AttendanceListFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("hr", "attendance", scope, filter as unknown as Record<string, unknown>),
    queryFn: () => listAttendance(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}
