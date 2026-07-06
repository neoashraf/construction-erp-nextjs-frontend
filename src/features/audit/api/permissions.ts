import { apiClient } from "@/lib/api";
import { type PermissionCatalog } from "../types";

/**
 * Permissions API bindings (API contract 05 § Permissions, Admin only · RBAC v2).
 * The editor's grid is sourced entirely from the **Resource Catalogue**; grid
 * edits persist through the role's atomic batch endpoint
 * (`PATCH /api/roles/:id/permissions`, see api/roles.ts) — the per-item
 * `POST`/`PATCH`/`DELETE /api/permissions` writes are no longer used by this screen.
 *
 * Import boundary: this feature imports `@/lib/api`, never `@/lib/api/generated/*`.
 */

interface Envelope<T> {
  data: T;
}

/**
 * GET the Resource Catalogue — the grid's ONLY row source (FR-AUD-035). Modules →
 * resources (screen/feature) → the actions each resource declares. Static per release.
 */
export async function getPermissionCatalog(): Promise<PermissionCatalog> {
  const res = await apiClient.get<Envelope<PermissionCatalog>>("/permissions/catalog");
  return res.data;
}
