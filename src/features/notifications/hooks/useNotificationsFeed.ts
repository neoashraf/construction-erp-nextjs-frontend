import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listNotifications } from "../api/notifications";
import {
  DRAWER_PAGE_SIZE,
  PAGE_PAGE_SIZE,
  type Notification,
  type NotificationsFeedFilters,
  type NotificationsFeedResponse,
} from "../types";

/**
 * FE-53 feed hooks. The drawer key is a fixed "drawer" scope (single page —
 * the drawer infinite-scrolls in memory once implemented). The page key
 * includes filters + page so switching filters/pages evicts + refetches.
 */

function scope(companyId: string, userId: string, kind: "drawer" | "page", params: unknown) {
  return `${companyId}:${userId}:${kind}:${JSON.stringify(params)}`;
}

export function useDrawerFeed(open: boolean) {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.detail(
      "notifications",
      "feed",
      scope(user.companyId, user.id, "drawer", { pageSize: DRAWER_PAGE_SIZE }),
    ),
    queryFn: () => listNotifications({ page: 1, pageSize: DRAWER_PAGE_SIZE }),
    enabled: open,
    staleTime: 15_000,
  });
}

export function usePageFeed(
  filters: NotificationsFeedFilters,
  page: number,
  pageSize: number = PAGE_PAGE_SIZE,
) {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.detail(
      "notifications",
      "feed",
      scope(user.companyId, user.id, "page", { ...filters, page, pageSize }),
    ),
    queryFn: () => listNotifications({ ...filters, page, pageSize }),
    staleTime: 5_000,
  });
}

/** Imperative helpers for the socket layer to mutate the drawer feed cache. */
export function useFeedCacheHelpers() {
  const user = useAuthenticatedUser();
  const qc = useQueryClient();
  const drawerKey = queryKeys.detail(
    "notifications",
    "feed",
    scope(user.companyId, user.id, "drawer", { pageSize: DRAWER_PAGE_SIZE }),
  );
  return {
    /** Prepend a new pushed row (dedupe on id). */
    prepend: (row: Notification) => {
      qc.setQueryData<NotificationsFeedResponse | undefined>(drawerKey, (prev) => {
        if (!prev) return { data: [row], meta: { page: 1, pageSize: DRAWER_PAGE_SIZE, total: 1 } };
        if (prev.data.some((r) => r.id === row.id)) return prev;
        return {
          data: [row, ...prev.data].slice(0, DRAWER_PAGE_SIZE),
          meta: { ...prev.meta, total: prev.meta.total + 1 },
        };
      });
    },
    /** Mark a single row read in the drawer cache (used for optimistic update). */
    markRead: (id: string, readAt: string) => {
      qc.setQueryData<NotificationsFeedResponse | undefined>(drawerKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((r) => (r.id === id ? { ...r, readAt } : r)),
        };
      });
      qc.invalidateQueries({
        queryKey: queryKeys.detail("notifications", "feed", `${user.companyId}:${user.id}:page:`),
        exact: false,
      });
    },
    /** Mark ALL rows read in the drawer cache (optimistic mark-all). */
    markAll: (readAt: string) => {
      qc.setQueryData<NotificationsFeedResponse | undefined>(drawerKey, (prev) =>
        prev ? { ...prev, data: prev.data.map((r) => (r.readAt ? r : { ...r, readAt })) } : prev,
      );
      qc.invalidateQueries({
        queryKey: queryKeys.detail("notifications", "feed", `${user.companyId}:${user.id}:page:`),
        exact: false,
      });
    },
    /** Revert a single row back to unread on a REST failure. */
    revertRead: (id: string) => {
      qc.setQueryData<NotificationsFeedResponse | undefined>(drawerKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((r) => (r.id === id ? { ...r, readAt: null } : r)),
        };
      });
    },
    /** Force a refetch of the drawer (used on reconnect reconciliation). */
    refetchDrawer: () => qc.invalidateQueries({ queryKey: drawerKey }),
    /** Latest known `createdAt` — used as `since` for reconnect reconciliation. */
    getLatestCreatedAt(): string | null {
      const cur = qc.getQueryData<NotificationsFeedResponse | undefined>(drawerKey);
      if (!cur || cur.data.length === 0) return null;
      return cur.data.reduce<string>(
        (acc, r) => (r.createdAt > acc ? r.createdAt : acc),
        cur.data[0]!.createdAt,
      );
    },
  };
}
