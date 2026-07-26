import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  getDeviceStatus,
  getSummaryReport,
  getSyncStatus,
  listAttendanceLogs,
  runSync,
  type AttendanceLogQuery,
  type SyncSummary,
} from "../api/attendance-logs";

/**
 * Query hooks for the biometric attendance-log screen.
 *
 * React Query owns request lifecycle here — a key change cancels the in-flight request and
 * discards out-of-order responses, so there is no hand-rolled `AbortController` or
 * `mounted` flag anywhere in this feature. `placeholderData: keepPreviousData` keeps the
 * previous page visible (dimmed) while the next one loads, instead of flashing empty.
 *
 * Keys are tenant-scoped via `queryKeys.list`, so switching company/FY can't serve another
 * tenant's rows from cache.
 */

/** Poll interval for the device heartbeat. */
const DEVICE_POLL_MS = 10_000;

function useScope() {
  const user = useAuthenticatedUser();
  return { companyId: user.companyId, financialYearId: user.financialYearId };
}

/** Paged `/logs` rows. Disabled while summary mode is active. */
export function useAttendanceLogs(query: AttendanceLogQuery, enabled = true) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("hr", "attendance-logs", scope, query as unknown as Record<string, unknown>),
    queryFn: () => listAttendanceLogs(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Aggregated `/reports/summary` rows. Disabled unless summary mode is active. */
export function useAttendanceSummary(query: AttendanceLogQuery, enabled = true) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("hr", "attendance-summary", scope, query as unknown as Record<string, unknown>),
    queryFn: () => getSummaryReport(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Device heartbeat. Polls on a fixed interval and never retries — a failed poll simply
 * means "offline", and a retry storm would only delay the next honest reading.
 */
export function useDeviceStatus() {
  return useQuery({
    queryKey: ["hr", "attendance-device-status"],
    queryFn: getDeviceStatus,
    refetchInterval: DEVICE_POLL_MS,
    retry: false,
    staleTime: 0,
  });
}

/**
 * Last-sync context for the Sync button's tooltip.
 *
 * Deliberately failure-tolerant: this is informational only, so a broken status endpoint
 * must never gate the ability to actually run a sync.
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: ["hr", "attendance-sync-status"],
    queryFn: getSyncStatus,
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * Run a device sync, then refresh everything it can change: log rows, summary rows and the
 * sync-status hint. Invalidation (rather than a manual refresh counter) also refreshes the
 * open detail drawer, since it reads from the same cached page.
 */
export function useRunSync(onSuccess?: (summary: SyncSummary) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runSync,
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance-logs"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance-sync-status"] });
      onSuccess?.(summary);
    },
  });
}

/**
 * Plain-language summary of what a sync actually changed, e.g.
 * `"3 employee(s) added · 2 name(s) updated · 41 new record(s)"`. Returns a stable
 * "Already up to date" when nothing moved, so a no-op sync still reads as a success.
 */
export function describeSyncSummary(summary: SyncSummary): string {
  const parts: string[] = [];
  if (summary.users.created > 0) parts.push(`${summary.users.created} employee(s) added`);
  if (summary.users.updated > 0) parts.push(`${summary.users.updated} name(s) updated`);
  if (summary.attendance.inserted > 0) parts.push(`${summary.attendance.inserted} new record(s)`);
  return parts.length > 0 ? parts.join(" · ") : "Already up to date";
}
