"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationRow } from "./NotificationRow";
import { type Notification } from "../types";

/**
 * FE-53 shared list — the drawer + page render rows through this. States:
 * loading (row skeletons), empty ("You're all caught up." or the filtered
 * variant, per the caller), error+Retry, and a compact end-of-list marker on
 * the drawer surface.
 */
export function NotificationsList({
  rows,
  isLoading,
  isError,
  emptyLabel,
  onRetry,
  onOpen,
  onMarkRead,
  showEndMarker,
}: {
  rows: Notification[] | undefined;
  isLoading: boolean;
  isError: boolean;
  emptyLabel: string;
  onRetry: () => void;
  onOpen: (n: Notification) => void;
  onMarkRead: (n: Notification) => void;
  showEndMarker?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4" data-testid="notifications-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 border-b border-border/60 pb-3">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-6" data-testid="notifications-error">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load notifications."
          action={
            <Button size="sm" onClick={onRetry} data-testid="notifications-retry">
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="p-6" data-testid="notifications-empty">
        <EmptyState icon={Inbox} title={emptyLabel} />
      </div>
    );
  }
  return (
    <ul role="list" className="divide-y divide-border/70" data-testid="notifications-list">
      {rows.map((n) => (
        <NotificationRow key={n.id} n={n} onOpen={onOpen} onMarkRead={onMarkRead} />
      ))}
      {showEndMarker && (
        <li className="px-4 py-3 text-center text-[11px] text-muted-foreground" data-testid="notifications-end">
          That&rsquo;s everything from the last 30 days
        </li>
      )}
    </ul>
  );
}
