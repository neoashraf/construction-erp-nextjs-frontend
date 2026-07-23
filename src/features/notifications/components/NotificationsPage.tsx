"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMarkRead } from "../hooks/useMarkRead";
import { usePageFeed } from "../hooks/useNotificationsFeed";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { PAGE_PAGE_SIZE, type Notification } from "../types";
import {
  DEFAULT_FILTERS,
  NotificationsFilters,
  toApiFilters,
  type NotificationsFiltersValue,
} from "./NotificationsFilters";
import { NotificationsList } from "./NotificationsList";

/**
 * FE-53 top-level `/notifications` page — H1 identity + unread pill + Mark all
 * read + filter bar (All/Unread + Type + Since) + paginated list + Prev/Next.
 * No breadcrumb (spec §4, top-level).
 */
export function NotificationsPage() {
  const [applied, setApplied] = useState<NotificationsFiltersValue>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const apiFilters = useMemo(() => toApiFilters(applied), [applied]);
  const feed = usePageFeed(apiFilters, page, PAGE_PAGE_SIZE);
  const unread = useUnreadCount();
  const { markOne, markAll, markError } = useMarkRead();

  const rows = feed.data?.data;
  const meta = feed.data?.meta;
  const total = meta?.total ?? 0;
  const start = rows && rows.length ? (page - 1) * PAGE_PAGE_SIZE + 1 : 0;
  const end = rows ? (page - 1) * PAGE_PAGE_SIZE + rows.length : 0;
  const totalPages = total > 0 ? Math.ceil(total / PAGE_PAGE_SIZE) : 1;
  const filtered =
    applied.readState !== "ALL" || applied.type !== "" || applied.since !== "";

  // A compact window of up to 5 page numbers centred on the current page.
  const pageNumbers = useMemo(() => {
    const span = Math.min(5, totalPages);
    let first = Math.max(1, page - Math.floor(span / 2));
    first = Math.min(first, totalPages - span + 1);
    return Array.from({ length: span }, (_, i) => first + i);
  }, [page, totalPages]);

  function onOpenRow(n: Notification) {
    if (n.readAt === null) void markOne(n.id, true).catch(() => undefined);
  }

  return (
    <div className="mx-auto max-w-[860px] px-6 py-6" data-testid="notifications-page">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-[280px]">
          <div className="flex items-center gap-2">
            <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="page-title">
              Notifications
            </h1>
            {(unread.data ?? 0) > 0 && (
              <Badge tone="info" data-testid="page-unread-pill">
                {unread.data} unread
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Everything you&rsquo;ve been sent, most recent first. Click a row to open its source;
            it&rsquo;s marked read as you go.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void markAll().catch(() => undefined)}
          disabled={(unread.data ?? 0) === 0}
          data-testid="page-mark-all"
          className="shrink-0 whitespace-nowrap"
        >
          <Check className="h-4 w-4" aria-hidden />
          Mark all read
        </Button>
      </div>

      <NotificationsFilters
        value={applied}
        onApply={(v) => {
          setApplied(v);
          setPage(1);
        }}
        onClear={() => {
          setApplied(DEFAULT_FILTERS);
          setPage(1);
        }}
      />

      {markError && (
        <div
          className="mt-3 rounded-card border border-destructive/40 bg-destructive-soft px-4 py-2 text-[12px] text-destructive-ink"
          role="alert"
          data-testid="page-mark-error"
        >
          {markError}
        </div>
      )}

      <div className="mt-3.5 overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <NotificationsList
          rows={rows}
          isLoading={feed.isLoading}
          isError={feed.isError}
          emptyLabel={
            filtered ? "No notifications match these filters." : "You're all caught up."
          }
          onRetry={() => feed.refetch()}
          onOpen={onOpenRow}
          onMarkRead={(n) => void markOne(n.id, true).catch(() => undefined)}
          showMarkRead={false}
        />
      </div>

      {rows && rows.length > 0 && (
        <div className="mt-3.5 flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span data-testid="page-pagination-summary">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {start}&ndash;{end}
            </span>{" "}
            of <span className="font-semibold text-foreground">{total}</span> notifications{" "}
            <span className="text-faint">&middot; page size {PAGE_PAGE_SIZE}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="page-prev"
            >
              Prev
            </Button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={p === page ? "page" : undefined}
                data-testid={`page-num-${p}`}
                className={cn(
                  "grid h-[30px] min-w-[30px] place-items-center rounded-token px-2 text-[12.5px] font-semibold transition-colors",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "border border-border-strong bg-surface text-foreground hover:bg-surface-2",
                )}
              >
                {p}
              </button>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              data-testid="page-next"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
