import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  getDeviceStatus,
  getSummaryReport,
  getSyncStatus,
  importAttendanceRows,
  listAttendanceLogs,
  runSync,
  type AttendanceLogQuery,
  type ImportResult,
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
 * Import parsed spreadsheet rows, then refresh exactly what a sync refreshes.
 *
 * Import writes to the same `checkin_log` → `attendance_record` rail as the device, so it can
 * change the same cached views — invalidating less would leave the table showing pre-import
 * counts until the next filter change, which reads as "the import did nothing".
 */
export function useImportAttendance(onSuccess?: (result: ImportResult) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importAttendanceRows,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance-logs"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance-sync-status"] });
      onSuccess?.(result);
    },
  });
}

/**
 * Plain-language summary of an import.
 *
 * `duplicates` is reported rather than hidden because it answers the question an operator
 * actually has when re-uploading a file: nothing was doubled. A run that inserts nothing and
 * duplicates everything is a SUCCESS — it means the data was already there.
 */
export function describeImportResult(result: ImportResult): string {
  if (result.acceptedRows === 0) {
    return result.errors.length > 0
      ? `No rows imported — ${result.errors.length} row(s) had errors`
      : "No rows imported";
  }

  const parts: string[] = [`${result.acceptedRows} row(s) read`];
  if (result.inserted > 0) parts.push(`${result.inserted} new punch(es)`);
  if (result.duplicates > 0) parts.push(`${result.duplicates} already present`);
  if (result.reconciled > 0) parts.push(`${result.reconciled} day(s) updated`);

  const blocked = Object.values(result.skippedReasons).reduce((sum, n) => sum + n, 0);
  if (blocked > 0 && result.reconciled === 0) {
    const [reason] = Object.entries(result.skippedReasons).sort((a, b) => b[1] - a[1])[0] ?? [];
    return `Stored, but nothing reached the reports — ${blocked} day(s) blocked${
      reason ? ` (${humanizeSkipReason(reason)})` : ""
    }`;
  }
  if (blocked > 0) parts.push(`${blocked} day(s) blocked`);
  if (result.errors.length > 0) parts.push(`${result.errors.length} row(s) skipped`);

  return parts.join(" · ");
}

/**
 * Plain-language summary of what a sync actually changed, e.g.
 * `"41 day(s) reconciled · 2 could not be placed"`.
 *
 * The skipped count is surfaced rather than hidden: those punches exist but are missing from
 * the reports, and only an admin fixing the employee/project data can bring them in.
 *
 * Deliberately terse when nothing moved. This string appears as transient feedback beside the
 * button, so it must describe *the click* — "Nothing to reconcile" — and not editorialise
 * about the state of the data, which belongs in the table's own empty state.
 */
export function describeSyncSummary(summary: SyncSummary): string {
  const parts: string[] = [];
  if (summary.users.created > 0) parts.push(`${summary.users.created} employee(s) added`);
  if (summary.users.updated > 0) parts.push(`${summary.users.updated} name(s) updated`);
  if (summary.attendance.inserted > 0) {
    parts.push(`${summary.attendance.inserted} new punch(es)`);
  }
  if (summary.reconciled > 0) parts.push(`${summary.reconciled} day(s) reconciled`);

  const blocked = Object.values(summary.skippedReasons).reduce((sum, n) => sum + n, 0);
  if (blocked > 0 && summary.reconciled === 0) {
    // The failure worth shouting about: punches were stored but none of them will show up
    // in a report. Naming the dominant reason turns a mystery into a fixable task.
    const [reason] = Object.entries(summary.skippedReasons).sort((a, b) => b[1] - a[1])[0] ?? [];
    return `Nothing reached the reports — ${blocked} day(s) blocked${reason ? ` (${humanizeSkipReason(reason)})` : ""}`;
  }
  if (blocked > 0) parts.push(`${blocked} day(s) blocked`);

  return parts.length > 0 ? parts.join(" · ") : "Already up to date";
}

/** Turn a server skip code into something an operator can act on. */
function humanizeSkipReason(reason: string): string {
  switch (reason) {
    case "NO_FINANCIAL_YEAR":
      return "no financial year covers those dates";
    case "NO_PROJECT":
      return "employees have no project assigned";
    case "UNKNOWN_EMPLOYEE_CODE":
      return "unknown employee codes";
    case "ALREADY_CONFIRMED":
      return "already posted to the ledger";
    default:
      return reason.toLowerCase().replace(/_/g, " ");
  }
}
