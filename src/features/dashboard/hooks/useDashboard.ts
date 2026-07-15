"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getDashboard, refreshTile } from "../api/dashboard";
import { type DashboardScope, type Tile, type TileKey } from "../types";

export function useDashboard(scope: DashboardScope) {
  const user = useAuthenticatedUser();
  return useQuery<Tile[]>({
    queryKey: queryKeys.list(
      "dashboard",
      "tiles",
      { companyId: user.companyId, financialYearId: scope.financialYearId },
      { projectId: scope.projectId },
    ),
    queryFn: () => getDashboard(scope),
    retry: false,
    staleTime: 0,
  });
}

/**
 * Refresh a single tile and swap it into the dashboard cache in-place so the
 * rest of the grid stays untouched (FR-DSH-005). Errors are surfaced to the
 * caller so the tile can render its inline error card without blocking the
 * page-level query.
 */
export function useTileRefresh(scope: DashboardScope) {
  const user = useAuthenticatedUser();
  const qc = useQueryClient();
  const listKey = queryKeys.list(
    "dashboard",
    "tiles",
    { companyId: user.companyId, financialYearId: scope.financialYearId },
    { projectId: scope.projectId },
  );
  return useMutation<Tile, unknown, TileKey>({
    mutationFn: (key) => refreshTile(key, scope),
    onSuccess: (fresh) => {
      qc.setQueryData<Tile[] | undefined>(listKey, (prev) => {
        if (!prev) return prev;
        return prev.map((t) => (t.key === fresh.key ? fresh : t));
      });
    },
  });
}
