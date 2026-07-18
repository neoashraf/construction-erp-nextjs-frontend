import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listRetentionReleases } from "../api/ipc-register";
import { type RetentionRelease } from "../types";

/**
 * Per-IPC retention-releases audit hook (spec §5 "Retention releases list"; FR-SAL-018).
 * One hook per IPC-row expander so a single-IPC fetch failure surfaces only for that row
 * (spec §6 partial state) — the panel-level fetch is independent. `enabled` keeps the query
 * dormant until the expander opens.
 */
export function useRetentionReleases(ipcId: string, enabled: boolean) {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: ["sales-ipc", "retention-releases", user.companyId, ipcId],
    queryFn: () => listRetentionReleases(ipcId),
    enabled: enabled && !!ipcId,
  });
}

export interface IpcReleaseSummary {
  /** Number of posted releases against this IPC (the design's RELEASES count). */
  count: number;
  /** Σ released amount (Decimal string) — used to derive held-net = gross − released. */
  releasedTotal: string;
  /** The releases themselves, for the expandable audit sub-row (avoids a second fetch). */
  releases: RetentionRelease[];
  isLoading: boolean;
  /** The per-IPC releases fetch failed → surface a partial state on that row (spec §6). */
  isError: boolean;
}

/**
 * Retention releases for EVERY IPC in the register's breakdown, fetched in parallel via
 * `useQueries` (mirrors REQ's `useOnHandBalances`). The design's per-IPC breakdown shows a
 * distinct HELD (NET) column and a RELEASES count inline — neither is on the register-read
 * shape — so we derive both from the existing `GET …/ipc/{id}/retention-releases` endpoint
 * (no contract change). Shares the same query key as the per-row expander hook, so opening a
 * row reuses this cache rather than refetching. `retry:false` so a `403`/`404` surfaces at
 * once as a per-row partial rather than blocking the panel.
 */
export function useRetentionReleasesForIpcs(
  ipcIds: string[],
  enabled: boolean,
): Record<string, IpcReleaseSummary> {
  const user = useAuthenticatedUser();
  const results = useQueries({
    queries: ipcIds.map((ipcId) => ({
      queryKey: ["sales-ipc", "retention-releases", user.companyId, ipcId],
      queryFn: () => listRetentionReleases(ipcId),
      enabled: enabled && !!ipcId,
      retry: false,
    })),
  });

  const idsKey = ipcIds.join("|");
  const resultsKey = results
    .map((r) => `${r.isLoading}:${r.isError}:${(r.data as RetentionRelease[] | undefined)?.length ?? "?"}`)
    .join("|");

  return useMemo(() => {
    const map: Record<string, IpcReleaseSummary> = {};
    ipcIds.forEach((ipcId, i) => {
      const r = results[i];
      const releases = (r?.data as RetentionRelease[] | undefined) ?? [];
      const releasedTotal = releases
        .reduce((sum, x) => sum + Number(x.releasedAmount), 0)
        .toFixed(4);
      map[ipcId] = {
        count: releases.length,
        releasedTotal,
        releases,
        isLoading: !!r?.isLoading,
        isError: !!r?.isError,
      };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, resultsKey]);
}
