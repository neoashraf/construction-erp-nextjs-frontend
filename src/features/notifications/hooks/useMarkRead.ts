import { useCallback, useState } from "react";
import { asApiError } from "@/lib/api/errors";
import { markAllRead, markRead } from "../api/notifications";
import { useFeedCacheHelpers } from "./useNotificationsFeed";
import { useSetUnreadCount, useUnreadCount } from "./useUnreadCount";

/**
 * FE-53 — optimistic mark-one / mark-all with revert on failure. Both mutations
 * write into the drawer cache directly (via the shared feed helpers) so the row
 * mutes immediately, then confirm via REST. On failure the row flips back to
 * unread and an inline error message flows to the caller.
 */
export function useMarkRead() {
  const helpers = useFeedCacheHelpers();
  const setCount = useSetUnreadCount();
  const currentCount = useUnreadCount();
  const [markError, setMarkError] = useState<string | null>(null);

  const markOne = useCallback(
    async (id: string, wasUnread: boolean): Promise<void> => {
      setMarkError(null);
      // Optimistic — flip UI first.
      if (wasUnread) {
        helpers.markRead(id, new Date().toISOString());
        setCount(Math.max(0, (currentCount.data ?? 0) - 1));
      }
      try {
        await markRead(id);
      } catch (err) {
        if (wasUnread) {
          helpers.revertRead(id);
          setCount((currentCount.data ?? 0));
        }
        setMarkError(mapMarkError(asApiError(err).code));
        throw err;
      }
    },
    [helpers, setCount, currentCount.data],
  );

  const markAll = useCallback(async (): Promise<void> => {
    setMarkError(null);
    const previousCount = currentCount.data ?? 0;
    helpers.markAll(new Date().toISOString());
    setCount(0);
    try {
      await markAllRead();
    } catch (err) {
      // Force a re-fetch from the server to restore the truth.
      helpers.refetchDrawer();
      setCount(previousCount);
      setMarkError(mapMarkError(asApiError(err).code));
      throw err;
    }
  }, [helpers, setCount, currentCount.data]);

  return { markOne, markAll, markError, clearMarkError: () => setMarkError(null) };
}

function mapMarkError(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "This notification is no longer available.";
    case "NETWORK_ERROR":
      return "Can't reach the server. Check your connection and try again.";
    default:
      return "Couldn't mark read. Try again.";
  }
}
