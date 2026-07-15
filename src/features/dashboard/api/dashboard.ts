import { apiClient } from "@/lib/api/client";
import { type DashboardScope, type Tile, type TileKey } from "../types";

/** GET /api/dashboard — the caller's full role-scoped tile array. */
export function getDashboard(scope: DashboardScope): Promise<Tile[]> {
  const q = new URLSearchParams();
  if (scope.financialYearId) q.set("financialYearId", scope.financialYearId);
  if (scope.projectId) q.set("projectId", scope.projectId);
  const suffix = q.toString();
  return apiClient
    .get<{ data: Tile[] }>(`/dashboard${suffix ? `?${suffix}` : ""}`)
    .then((r) => r.data);
}

/** GET /api/dashboard/tiles/{key} — single-tile refresh. */
export function refreshTile(key: TileKey, scope: DashboardScope): Promise<Tile> {
  const q = new URLSearchParams();
  if (scope.financialYearId) q.set("financialYearId", scope.financialYearId);
  if (scope.projectId) q.set("projectId", scope.projectId);
  const suffix = q.toString();
  return apiClient
    .get<{ data: Tile }>(`/dashboard/tiles/${key}${suffix ? `?${suffix}` : ""}`)
    .then((r) => r.data);
}
