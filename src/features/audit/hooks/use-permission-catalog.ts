import { useQuery } from "@tanstack/react-query";
import { getPermissionCatalog } from "../api";

/**
 * The Resource Catalogue query (RBAC v2 · FR-AUD-035). The grid's ONLY row source
 * — modules → resources → the actions each declares. Static per release, so it's
 * cached aggressively; a fetch failure blocks the grid (the screen shows Retry).
 * `enabled` lets the Admin-only screen skip it for a non-Admin session.
 */
export const PERMISSION_CATALOG_KEY = ["audit", "permission-catalog"] as const;

export function usePermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: PERMISSION_CATALOG_KEY,
    queryFn: () => getPermissionCatalog(),
    enabled,
    staleTime: 10 * 60 * 1000, // static per release
    retry: false,
  });
}
