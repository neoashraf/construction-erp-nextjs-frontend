"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { SeverityBadge } from "./SeverityBadge";
import { modulePresentation } from "../module-presentation";
import { type Notification } from "../types";

/**
 * FE-53 single notification row — the drawer + page share this. Layout mirrors
 * the design file (frame 01/02): a left 2-letter module tint chip, then title +
 * relative time + unread blue dot on the top line, the body, and a footer line
 * carrying the human source label and (for HIGH) a severity pill. Unread rows
 * get a tinted info background and bold title; HIGH rows add an inset red left
 * rail. Click-through follows `deepLink` and auto-marks read in the same
 * gesture; a `null` deepLink is informational (non-navigating). The drawer
 * surface also shows a per-row "Mark as read" affordance (`showMarkRead`); the
 * page surface does not.
 */
export function NotificationRow({
  n,
  onOpen,
  onMarkRead,
  showMarkRead = true,
}: {
  n: Notification;
  onOpen: (n: Notification) => void;
  onMarkRead: (n: Notification) => void;
  /** Render the per-row "Mark as read" button (drawer only, per design). */
  showMarkRead?: boolean;
}) {
  const router = useRouter();
  const unread = n.readAt === null;
  const clickable = !!n.deepLink;
  const high = n.severity === "HIGH";
  const mod = modulePresentation(n.sourceModule);

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
        "relative flex gap-3 px-4 py-3.5 outline-none transition-colors",
        unread ? "bg-info-soft/50" : "bg-surface",
        clickable && "cursor-pointer hover:bg-canvas focus-visible:bg-canvas",
      )}
      tabIndex={0}
      onClick={clickable ? handleActivate : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleActivate(e);
      }}
    >
      {high && (
        <span
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-destructive"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-[11px] font-bold",
          mod.chip,
        )}
        aria-hidden
      >
        {mod.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 break-words text-[13.5px] leading-snug text-foreground",
              unread ? "font-bold" : "font-medium",
            )}
            data-testid="notification-title"
          >
            {n.title}
          </p>
          <time
            dateTime={n.createdAt}
            title={safeAbsolute(n.createdAt)}
            className="mt-px shrink-0 whitespace-nowrap text-[11px] text-faint"
          >
            {relative(n.createdAt)}
          </time>
          {unread && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" aria-hidden />
          )}
        </div>
        <p
          className="mt-1 break-words text-[12.5px] leading-normal text-muted-foreground"
          data-testid="notification-body"
        >
          {n.body}
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <span
            className="text-[11px] font-semibold text-faint"
            data-testid="notification-source"
          >
            {mod.label}
          </span>
          {high && <SeverityBadge severity="HIGH" />}
          {showMarkRead && unread && (
            <>
              <span className="flex-1" />
              <button
                type="button"
                className="rounded-token px-2 py-0.5 text-[11px] font-semibold text-accent-ink hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-testid="notification-mark-read"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(n);
                }}
              >
                Mark as read
              </button>
            </>
          )}
        </div>
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
