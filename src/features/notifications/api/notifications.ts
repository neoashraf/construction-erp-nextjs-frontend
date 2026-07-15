import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type Notification,
  type NotificationsFeedFilters,
  type NotificationsFeedResponse,
} from "../types";

/**
 * FE-53 REST client for the NTF surface (api-contract 18). Every route is
 * self-scoped from the JWT (no `:userId`); a foreign id is a uniform 404.
 * Mark-read is idempotent (a second call on a read row is a 200 no-op).
 */

type Envelope<T> = { data: T };

function toQuery(filters: NotificationsFeedFilters & { page?: number; pageSize?: number }): string {
  const params = new URLSearchParams();
  if (filters.isRead !== undefined && filters.isRead !== null) {
    params.set("isRead", String(filters.isRead));
  }
  if (filters.type) params.set("type", filters.type);
  if (filters.since) params.set("since", filters.since);
  if (typeof filters.page === "number") params.set("page", String(filters.page));
  if (typeof filters.pageSize === "number") params.set("pageSize", String(filters.pageSize));
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function listNotifications(
  filters: NotificationsFeedFilters & { page?: number; pageSize?: number } = {},
): Promise<NotificationsFeedResponse> {
  return apiClient.get<NotificationsFeedResponse>(`/notifications${toQuery(filters)}`);
}

export function getUnreadCount(): Promise<number> {
  return apiClient
    .get<Envelope<{ unreadCount: number }>>("/notifications/unread-count")
    .then((r) => r.data.unreadCount);
}

export function getNotification(id: string): Promise<Notification> {
  return apiClient.get<Envelope<Notification>>(`/notifications/${id}`).then((r) => r.data);
}

export function markRead(id: string): Promise<void> {
  return apiClient.post<void>(`/notifications/${id}/read`, undefined, {
    csrfToken: readCsrfToken(),
  });
}

export function markAllRead(): Promise<{ updated: number }> {
  return apiClient
    .post<Envelope<{ updated: number }>>("/notifications/read-all", undefined, {
      csrfToken: readCsrfToken(),
    })
    .then((r) => r.data);
}
