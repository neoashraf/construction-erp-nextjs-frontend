import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getUnreadCount } from "../api/notifications";

export const UNREAD_COUNT_KEY = queryKeys.detail("notifications", "unread-count", "me");

/**
 * FE-53 — badge count. `refetchOnWindowFocus` is on so a second tab converges
 * on the initial mount. Live-syncing while a tab is open is done by the socket
 * (see `useNotificationsSocket`), which writes into this cache directly.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
    staleTime: 30_000,
  });
}

/** Imperative helper — set the badge from a socket push / mutation success. */
export function useSetUnreadCount() {
  const qc = useQueryClient();
  return (count: number) => qc.setQueryData(UNREAD_COUNT_KEY, count);
}
