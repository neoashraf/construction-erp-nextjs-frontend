"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Last-checked indicator + manual Refresh (spec §5/§9). This is a LIVE, pull-based feed —
 * there is no auto-poll/websocket in Phase 1, so the screen states when it last read and
 * offers a manual re-read. The timestamp lives in an `aria-live="polite"` region so a
 * refresh announces the new value without moving focus (§10).
 */

/** Coarse relative-time label ("just now" / "4 minutes ago" / "2 hours ago"). */
export function relativeTime(from: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function LastRefreshedIndicator({
  lastRefreshed,
  refreshing,
  disabled,
  onRefresh,
}: {
  lastRefreshed: Date | null;
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-live="polite"
        className="text-[12px] text-muted-foreground"
        data-testid="alerts-last-checked"
      >
        {lastRefreshed ? `Last checked ${relativeTime(lastRefreshed)}` : "Not checked yet"}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled || refreshing}
        onClick={onRefresh}
        data-testid="alerts-refresh"
      >
        <RefreshCw className={cnSpin(refreshing)} aria-hidden />
        {refreshing ? "Checking…" : "Refresh"}
      </Button>
    </div>
  );
}

function cnSpin(spinning: boolean): string {
  return spinning ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5";
}
