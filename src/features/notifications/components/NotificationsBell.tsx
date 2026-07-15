"use client";

import { useCallback, useState } from "react";
import { Bell } from "lucide-react";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { useNotificationsSocket } from "../hooks/useNotificationsSocket";
import { NotificationsDrawer } from "./NotificationsDrawer";
import { NotificationToast } from "./NotificationToast";
import { type Notification } from "../types";
import { markRead } from "../api/notifications";
import { type NotificationsSocket } from "../socket/notifications-socket";

/**
 * FE-53 topbar bell — shown for ALL authenticated roles (superseding the
 * CC-only over-budget bell). The badge reads `unread-count` and is
 * live-updated by the socket; it hides at 0 and caps at `9+`. Clicking opens
 * the drawer. Owns the shared socket lifecycle + the HIGH-toast queue.
 *
 * `overrideSocket` is a test seam that lets Jest drive `connected` /
 * `notification:new` / `notification:unreadCount` events manually.
 */
export interface NotificationsBellProps {
  /** Test seam — inject a manually driveable socket. */
  overrideSocket?: NotificationsSocket;
  /** Test seam — skip the initial `connect()`. */
  autoConnect?: boolean;
  /** Test seam — start the drawer open. */
  defaultOpen?: boolean;
}

export function NotificationsBell({
  overrideSocket,
  autoConnect = true,
  defaultOpen = false,
}: NotificationsBellProps = {}) {
  const [drawerOpen, setDrawerOpen] = useState(defaultOpen);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const unread = useUnreadCount();
  const count = unread.data ?? 0;

  const pushToast = useCallback((n: Notification) => {
    setToasts((prev) => (prev.some((t) => t.id === n.id) ? prev : [...prev, n]));
    // Auto-dismiss after 6s.
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 6000);
  }, []);

  const { status } = useNotificationsSocket({
    onHighPush: pushToast,
    overrideSocket,
    autoConnect,
  });

  const badgeVisible = count > 0;
  const label = badgeVisible ? `Notifications, ${count} unread` : "Notifications";

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        data-testid="notifications-bell"
        aria-label={label}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-border-strong hover:bg-canvas hover:text-foreground"
      >
        <Bell className="h-[17px] w-[17px]" aria-hidden />
        {badgeVisible && (
          <span
            data-testid="notifications-badge"
            aria-hidden
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      <NotificationsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        unreadCount={count}
        socketOffline={status === "offline"}
      />
      {/* HIGH toast host — bottom-right stack. */}
      {toasts.length > 0 && (
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[110] flex flex-col gap-2"
          role="region"
          aria-label="High-severity notifications"
          data-testid="notifications-toast-host"
        >
          {toasts.map((n) => (
            <NotificationToast
              key={n.id}
              notification={n}
              onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== n.id))}
              onOpen={(nn) => {
                // Auto-mark read on click-through (parity with row activate).
                if (nn.readAt === null) void markRead(nn.id).catch(() => undefined);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
