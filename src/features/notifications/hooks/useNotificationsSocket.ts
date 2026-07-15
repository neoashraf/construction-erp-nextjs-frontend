"use client";

import { useEffect, useRef, useState } from "react";
import { listNotifications } from "../api/notifications";
import { useFeedCacheHelpers } from "./useNotificationsFeed";
import { useSetUnreadCount } from "./useUnreadCount";
import {
  createNotificationsSocket,
  fetchSocketTicket,
  type NotificationsSocket,
  type SocketConnectedPayload,
  type SocketUnreadCountPayload,
} from "../socket/notifications-socket";
import { type Notification } from "../types";

/**
 * FE-53 — wire the socket to the query cache + a HIGH-toast callback. Owned by
 * the shell (one per session): `connect()` on mount, `disconnect()` on unmount.
 * A test-only `overrideSocket` lets Jest inject a manual driver (no real WS).
 * On reconnect: seed from `connected.unreadCount` + REST reconcile via
 * `since=<latestKnownCreatedAt>` (FR-NTF-011); dedupe on `notification.id`.
 */
export interface UseNotificationsSocketOptions {
  onHighPush?: (n: Notification) => void;
  /** Test seam — inject a manually driveable socket. */
  overrideSocket?: NotificationsSocket;
  /** Test seam — skip the initial `connect()` (some tests emit manually). */
  autoConnect?: boolean;
}

export function useNotificationsSocket({
  onHighPush,
  overrideSocket,
  autoConnect = true,
}: UseNotificationsSocketOptions = {}) {
  const helpers = useFeedCacheHelpers();
  const setCount = useSetUnreadCount();
  const [status, setStatus] = useState<"idle" | "connecting" | "online" | "offline">("idle");
  const socketRef = useRef<NotificationsSocket | null>(null);
  const highRef = useRef<typeof onHighPush>(onHighPush);
  highRef.current = onHighPush;

  useEffect(() => {
    const socket =
      overrideSocket ??
      createNotificationsSocket({
        getTicket: fetchSocketTicket,
      });
    socketRef.current = socket;

    const offConnected = socket.on("connected", (data) => {
      const payload = (data ?? {}) as Partial<SocketConnectedPayload>;
      if (typeof payload.unreadCount === "number") setCount(payload.unreadCount);
      setStatus("online");
      // Reconcile — read anything created since the newest known row (FR-NTF-011).
      void reconcile(helpers.getLatestCreatedAt()).then((rows) => {
        for (const row of rows) helpers.prepend(row);
      });
    });
    const offNew = socket.on("notification:new", (data) => {
      const row = data as Notification;
      helpers.prepend(row);
      if (row.severity === "HIGH" && highRef.current) highRef.current(row);
    });
    const offCount = socket.on("notification:unreadCount", (data) => {
      const payload = (data ?? {}) as Partial<SocketUnreadCountPayload>;
      if (typeof payload.unreadCount === "number") setCount(payload.unreadCount);
    });
    const offErr = socket.on("connect_error", () => setStatus("offline"));
    const offDisc = socket.on("disconnect", () => setStatus("offline"));

    if (autoConnect) {
      setStatus("connecting");
      void socket.connect();
    }

    return () => {
      offConnected();
      offNew();
      offCount();
      offErr();
      offDisc();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideSocket]);

  return { status, socket: socketRef.current };
}

async function reconcile(since: string | null): Promise<Notification[]> {
  try {
    const res = await listNotifications({ isRead: false, since, pageSize: 25 });
    return res.data;
  } catch {
    return [];
  }
}
