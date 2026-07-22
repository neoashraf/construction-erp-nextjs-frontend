import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
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
 * FE-53 feed hooks. The drawer is a single scope that paginates in place: page 1
 * loads on open, and "See more" appends the next page (useInfiniteQuery). The
 * page key includes filters + page so switching filters/pages evicts + refetches.
 */

function scope(companyId: string, userId: string, kind: "drawer" | "page", params: unknown) {
  return `${companyId}:${userId}:${kind}:${JSON.stringify(params)}`;
}

/** The one drawer query key — shared by the feed hook and the cache helpers. */
function drawerKey(companyId: string, userId: string) {
  return queryKeys.detail(
    "notifications",
    "feed",
    scope(companyId, userId, "drawer", { pageSize: DRAWER_PAGE_SIZE }),
  );
}

/** All loaded drawer pages, held under one infinite-query cache entry. */
type DrawerCache = InfiniteData<NotificationsFeedResponse, number>;

/** Is there a page after this one? (server paginates; the UI never recomputes totals.) */
function hasMorePages(meta: NotificationsFeedResponse["meta"]): boolean {
  return meta.page * meta.pageSize < meta.total;
}

export function useDrawerFeed(open: boolean) {
  const user = useAuthenticatedUser();
  return useInfiniteQuery({
    queryKey: drawerKey(user.companyId, user.id),
    queryFn: ({ pageParam }) =>
      listNotifications({ page: pageParam, pageSize: DRAWER_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      hasMorePages(lastPage.meta) ? lastPage.meta.page + 1 : undefined,
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
  const key = drawerKey(user.companyId, user.id);
  const pageKeyPrefix = queryKeys.detail(
    "notifications",
    "feed",
    `${user.companyId}:${user.id}:page:`,
  );

  /** A fresh single-page cache seeded with one row (drawer never fetched yet). */
  const seedCache = (row: Notification): DrawerCache => ({
    pages: [{ data: [row], meta: { page: 1, pageSize: DRAWER_PAGE_SIZE, total: 1 } }],
    pageParams: [1],
  });

  /** Map every loaded page's rows through `fn`. */
  const mapRows = (
    prev: DrawerCache | undefined,
    fn: (rows: Notification[]) => Notification[],
  ): DrawerCache | undefined =>
    prev ? { ...prev, pages: prev.pages.map((p) => ({ ...p, data: fn(p.data) })) } : prev;

  return {
    /** Prepend a new pushed row to page 1 (dedupe on id across all loaded pages). */
    prepend: (row: Notification) => {
      qc.setQueryData<DrawerCache>(key, (prev) => {
        if (!prev) return seedCache(row);
        if (prev.pages.some((p) => p.data.some((r) => r.id === row.id))) return prev;
        const [first, ...rest] = prev.pages;
        const grownFirst: NotificationsFeedResponse = {
          data: [row, ...first!.data],
          meta: { ...first!.meta, total: first!.meta.total + 1 },
        };
        return { ...prev, pages: [grownFirst, ...rest] };
      });
    },
    /** Mark a single row read in the drawer cache (used for optimistic update). */
    markRead: (id: string, readAt: string) => {
      qc.setQueryData<DrawerCache>(key, (prev) =>
        mapRows(prev, (rows) => rows.map((r) => (r.id === id ? { ...r, readAt } : r))),
      );
      qc.invalidateQueries({ queryKey: pageKeyPrefix, exact: false });
    },
    /** Mark ALL rows read in the drawer cache (optimistic mark-all). */
    markAll: (readAt: string) => {
      qc.setQueryData<DrawerCache>(key, (prev) =>
        mapRows(prev, (rows) => rows.map((r) => (r.readAt ? r : { ...r, readAt }))),
      );
      qc.invalidateQueries({ queryKey: pageKeyPrefix, exact: false });
    },
    /** Revert a single row back to unread on a REST failure. */
    revertRead: (id: string) => {
      qc.setQueryData<DrawerCache>(key, (prev) =>
        mapRows(prev, (rows) => rows.map((r) => (r.id === id ? { ...r, readAt: null } : r))),
      );
    },
    /** Force a refetch of the drawer (used on reconnect reconciliation). */
    refetchDrawer: () => qc.invalidateQueries({ queryKey: key }),
    /** Latest known `createdAt` across loaded pages — the `since` for reconnect reconciliation. */
    getLatestCreatedAt(): string | null {
      const cur = qc.getQueryData<DrawerCache>(key);
      const rows = cur?.pages.flatMap((p) => p.data) ?? [];
      if (rows.length === 0) return null;
      return rows.reduce<string>(
        (acc, r) => (r.createdAt > acc ? r.createdAt : acc),
        rows[0]!.createdAt,
      );
    },
  };
}
