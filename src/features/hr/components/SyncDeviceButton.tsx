"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { describeSyncSummary, useRunSync, useSyncStatus } from "../hooks/useAttendanceLogs";
import { formatRelativeTime } from "../lib/attendance-time";

/** How long the "what changed" line stays up before clearing itself. */
const MESSAGE_TTL_MS = 8000;

/**
 * Pull employees + punches from the biometric device.
 *
 * The sync-status read is informational: when it fails the tooltip degrades but the button
 * still works, because refusing to sync on the basis of a broken *status* endpoint would
 * block the very action that fixes stale data.
 */
export function SyncDeviceButton() {
  const statusQuery = useSyncStatus();
  const [message, setMessage] = useState<string | null>(null);

  const sync = useRunSync((summary) => setMessage(describeSyncSummary(summary)));

  // Clear the success line after a while so it doesn't read as the current state forever.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), MESSAGE_TTL_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const status = statusQuery.data;
  const configured = status?.configured ?? true;
  const lastSync = status?.lastSyncAt ? formatRelativeTime(status.lastSyncAt) : null;

  const tooltip = !configured
    ? "Device address is not configured on the server"
    : lastSync
      ? `Last synced ${lastSync}`
      : "Pull the latest punches from the device";

  const error = sync.error
    ? sync.error instanceof ApiError
      ? sync.error.message
      : "Sync failed"
    : null;

  return (
    <div className="flex items-center gap-2.5">
      {message ? (
        <span role="status" className="text-[12px] text-muted-foreground">
          {message}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-[12px] font-medium text-destructive-ink">
          {error}
        </span>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        title={tooltip}
        disabled={sync.isPending}
        onClick={() => sync.mutate()}
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
