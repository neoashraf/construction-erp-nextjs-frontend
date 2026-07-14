"use client";

import Link from "next/link";
import { X, WifiOff } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDrawerFeed } from "../hooks/useNotificationsFeed";
import { useMarkRead } from "../hooks/useMarkRead";
import { NotificationsList } from "./NotificationsList";
import { type Notification } from "../types";

/**
 * FE-53 bell drawer — right slide-over per design-system §3.7. Width ramps
 * 420px desktop / clamp(360, 44vw, 420) tablet / 100vw mobile. Header carries
 * the title, an "N unread" pill, Mark all read (disabled at 0), and ×.
 * Body infinite-scrolls in memory (Phase-1 renders page 1 — the infinite scroll
 * hook is a follow-up when the feed grows). An offline banner shows when the
 * socket is disconnected — the last-known feed still renders (FR-NTF-011).
 */
export function NotificationsDrawer({
  open,
  onOpenChange,
  unreadCount,
  socketOffline,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount: number;
  socketOffline: boolean;
}) {
  const feed = useDrawerFeed(open);
  const { markOne, markAll, markError } = useMarkRead();

  const rows = feed.data?.data;

  function onOpenRow(n: Notification) {
    if (n.readAt === null) void markOne(n.id, true).catch(() => undefined);
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-[fadeIn_0.2s_ease]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full flex-col bg-surface shadow-lg",
            "w-[100vw] sm:w-[clamp(360px,44vw,420px)] lg:w-[420px]",
            "data-[state=open]:animate-[slideInRight_0.24s_ease] focus:outline-none",
          )}
          data-testid="notifications-drawer"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <DialogPrimitive.Title className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
                Notifications
              </DialogPrimitive.Title>
              {unreadCount > 0 && (
                <Badge tone="info" data-testid="drawer-unread-pill">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void markAll().catch(() => undefined)}
                disabled={unreadCount === 0}
                className={cn(
                  "rounded-token px-2 py-1 text-[12px] font-semibold text-accent-ink hover:bg-accent-soft",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                data-testid="drawer-mark-all"
              >
                Mark all read
              </button>
              <DialogPrimitive.Close
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-token border border-border-strong bg-surface text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-testid="drawer-close"
              >
                <X className="h-4 w-4" aria-hidden />
              </DialogPrimitive.Close>
            </div>
          </div>

          {socketOffline && (
            <div
              className="flex items-center gap-2 border-b border-border bg-warning-soft px-4 py-2 text-[12px] text-warning-ink"
              role="status"
              aria-live="polite"
              data-testid="drawer-offline"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" aria-hidden />
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
              Live updates paused — reconnecting.
            </div>
          )}

          {markError && (
            <div
              className="border-b border-border bg-destructive-soft px-4 py-2 text-[12px] text-destructive-ink"
              role="alert"
              data-testid="drawer-mark-error"
            >
              {markError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <NotificationsList
              rows={rows}
              isLoading={feed.isLoading}
              isError={feed.isError}
              emptyLabel="You're all caught up."
              onRetry={() => feed.refetch()}
              onOpen={onOpenRow}
              onMarkRead={(n) => void markOne(n.id, true).catch(() => undefined)}
              showEndMarker={!!rows && rows.length > 0}
            />
          </div>

          <div className="border-t border-border px-4 py-2 text-center">
            <Link
              href="/notifications"
              className="text-[12px] font-semibold text-accent-ink hover:underline"
              data-testid="drawer-see-all"
              onClick={() => onOpenChange(false)}
            >
              See all
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
