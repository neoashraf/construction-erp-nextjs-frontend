"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { SeverityBadge } from "./SeverityBadge";
import { type Notification } from "../types";

/**
 * FE-53 single notification row — the drawer + page share this. Unread rows are
 * emphasised (blue dot, tinted background, bold title, "Mark as read" affordance);
 * read rows are muted. HIGH rows carry an inset red left rail + severity pill.
 * Click-through follows `deepLink` and auto-marks read in the same gesture;
 * a `null` deepLink is informational (non-navigating); an unresolved target
 * shows "This record is no longer available.".
 */
export function NotificationRow({
  n,
  onOpen,
  onMarkRead,
}: {
  n: Notification;
  onOpen: (n: Notification) => void;
  onMarkRead: (n: Notification) => void;
}) {
  const router = useRouter();
  const unread = n.readAt === null;
  const clickable = !!n.deepLink;

  function handleActivate(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    onOpen(n);
    if (!clickable) return;
    const params = n.deepLink!.params;
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    router.push(`${n.deepLink!.route}${query}`);
  }

  return (
    <li
      role="listitem"
      data-testid="notification-row"
      data-id={n.id}
      data-unread={unread ? "true" : "false"}
      data-severity={n.severity}
      className={cn(
        "relative flex gap-3 border-b border-border/70 px-4 py-3 outline-none transition-colors",
        unread ? "bg-info-soft/60" : "bg-surface",
        clickable && "cursor-pointer hover:bg-canvas focus-visible:bg-canvas",
      )}
      tabIndex={0}
      onClick={clickable ? handleActivate : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleActivate(e);
      }}
    >
      {n.severity === "HIGH" && (
        <span
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-destructive"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
          unread ? "bg-info" : "bg-transparent",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "break-words text-[13.5px] leading-snug",
                unread ? "font-bold text-foreground" : "font-medium text-muted-foreground",
              )}
              data-testid="notification-title"
            >
              {n.title}
            </p>
            <p
              className="mt-0.5 break-words text-[12px] leading-snug text-muted-foreground"
              data-testid="notification-body"
            >
              {n.body}
            </p>
          </div>
          {n.severity === "HIGH" && <SeverityBadge severity="HIGH" />}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            <span className="font-semibold uppercase tracking-wide">{n.sourceModule}</span>
            <span aria-hidden> · </span>
            <time dateTime={n.createdAt} title={safeAbsolute(n.createdAt)}>
              {relative(n.createdAt)}
            </time>
          </span>
          {unread && (
            <button
              type="button"
              className="rounded-token px-1.5 py-0.5 text-[11px] font-semibold text-accent-ink hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="notification-mark-read"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(n);
              }}
            >
              Mark as read
            </button>
          )}
        </div>
        {clickable ? null : (
          <p className="mt-1 text-[11px] italic text-muted-foreground">Informational</p>
        )}
      </div>
    </li>
  );
}

/** Legacy Link import kept to avoid dead-imports on future refactor. */
export const _LinkKeepAlive = Link;

function relative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return safeAbsolute(iso);
}

function safeAbsolute(iso: string): string {
  try {
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}
