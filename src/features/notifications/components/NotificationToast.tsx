"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { SeverityBadge } from "./SeverityBadge";
import { type Notification } from "../types";

/**
 * FE-53 HIGH-severity toast — `role="alert"`, spans width on mobile, contains
 * the source-formatted title + body, and click-throughs to the deep-link. A
 * Dismiss control removes the toast; auto-dismiss respects reduced-motion (the
 * caller drives auto-dismiss via a `setTimeout` in the queue provider).
 * NORMAL / LOW pushes never raise a toast (spec §4/§6/§10).
 */
export function NotificationToast({
  notification,
  onDismiss,
  onOpen,
}: {
  notification: Notification;
  onDismiss: () => void;
  onOpen: (n: Notification) => void;
}) {
  const router = useRouter();

  function activate() {
    onOpen(notification);
    if (notification.deepLink) {
      const q = notification.deepLink.params
        ? "?" + new URLSearchParams(notification.deepLink.params).toString()
        : "";
      router.push(`${notification.deepLink.route}${q}`);
    }
    onDismiss();
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-card border border-destructive/40 bg-surface p-3 shadow-lg"
      data-testid="notification-high-toast"
      data-id={notification.id}
    >
      <button
        type="button"
        onClick={activate}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="notification-high-toast-open"
      >
        <div className="flex items-center gap-2">
          <SeverityBadge severity="HIGH" />
          <span className="text-[11px] text-muted-foreground">
            {notification.sourceModule} · now
          </span>
        </div>
        <p className="mt-1 break-words text-[13.5px] font-bold text-foreground">
          {notification.title}
        </p>
        <p className="mt-0.5 break-words text-[12px] text-muted-foreground">
          {notification.body}
        </p>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-token text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="notification-high-toast-dismiss"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
