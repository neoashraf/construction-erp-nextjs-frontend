import { useQuery } from "@tanstack/react-query";
import { getAttendanceSettings } from "../api/salary";

/**
 * Company attendance settings (`GET /api/settings/attendance`) — read here only for copy
 * interpolation: the Late column's tooltip names the company's `latesPerDeductedDay`
 * (FR-HR-008c), never a hard-coded 3. Long stale time: a company setting changed mid-review
 * is rare, and the figure is explanatory, not computational.
 */
export function useAttendanceSettings() {
  return useQuery({
    queryKey: ["hr", "attendance-settings"] as const,
    queryFn: getAttendanceSettings,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
