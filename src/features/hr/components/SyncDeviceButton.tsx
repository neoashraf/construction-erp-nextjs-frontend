"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { describeSyncSummary, useRunSync, useSyncStatus } from "../hooks/useAttendanceLogs";
import { type SyncSummary } from "../api/attendance-logs";
import { formatRelativeTime } from "../lib/attendance-time";

/**
 * Pull the roster and punch history from the biometric device.
 *
 * The server opens a socket to the device, syncs employees, stores punches and folds them
 * into attendance records. Idempotent — pressing twice re-reports the same punches as
 * duplicates rather than doubling history.
 *
 * When no device address is configured the backend falls back to RE-RECONCILING punches it
 * already holds, which is still useful: ingestion skips any employee-day it cannot place
 * (unknown employee code, missing project, no financial year) and nothing retries those on
 * its own. Either way the button does the most useful thing available, so the UI does not
 * branch on which mode ran.
 *
 * The status read is informational: when it fails the tooltip degrades but the button still
 * works, because a broken *status* endpoint must not block the action that fixes stale data.
 */
export function SyncDeviceButton({
  onComplete,
}: {
  /**
   * Receives the run summary so the caller can raise the persistent FR-HR-008a warning.
   * A toast cannot carry that: it disappears, and the run it describes needs an action.
   */
  onComplete?: (summary: SyncSummary) => void;
} = {}) {
  const { toast } = useToast();
  const statusQuery = useSyncStatus();

  const sync = useRunSync((summary) => {
    onComplete?.(summary);
    // A sync that stored punches but reconciled none is NOT a success — the reports stay
    // empty. FR-HR-008a requires a persistent `role="alert"` INSTEAD OF the success toast,
    // so the toast is suppressed here and `onComplete` renders the warning.
    const blocked = summary.reconciled === 0 && Object.keys(summary.skippedReasons).length > 0;
    if (blocked) return;
    toast(describeSyncSummary(summary), "success");
  });

  const status = statusQuery.data;
  const lastSync = status?.lastSyncAt ? formatRelativeTime(status.lastSyncAt) : null;
  // Freshness is the newest punch actually received, whichever path delivered it.
  const received = status?.lastRecordAt ? formatRelativeTime(status.lastRecordAt) : null;

  const tooltip = !status
    ? "Pull the latest roster and punches from the device"
    : !status.configured
      ? "No device address configured — re-reconciles stored punches instead"
      : lastSync
        ? `Last synced ${lastSync}`
        : received
          ? `Last punch received ${received}`
          : `Pull the latest roster and punches from ${status.deviceIp ?? "the device"}`;

  return (
    // No inline result text. Sync messages can run long ("Nothing reached the reports — 143
    // day(s) blocked…") and rendering one as a flex sibling stretched this row, shoving the
    // header buttons out of place the moment a sync finished. The outcome goes to a toast
    // instead — the project's standard channel for it — so the header's width never changes.
    <div className="flex items-center gap-2.5">
      <Button
        variant="outline"
        size="sm"
        title={tooltip}
        disabled={sync.isPending}
        onClick={() =>
          sync.mutate(undefined, {
            // Surface the server's own wording — 503 "not configured", 502 "device did not
            // answer" and 409 "already running" each tell the user something different.
            onError: (err) =>
              toast(err instanceof ApiError ? err.message : "Sync failed", "error"),
          })
        }
        data-testid="sync-device"
      >
        <RefreshCw
          className={sync.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          aria-hidden
        />
        {sync.isPending ? "Syncing…" : "Sync device"}
      </Button>
    </div>
  );
}
