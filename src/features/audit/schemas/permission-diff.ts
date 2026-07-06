import {
  type RoleDetail,
  type PendingPermissionMap,
  type PendingCellEdit,
  type PermissionInput,
  type ProjectScope,
} from "../types";

/**
 * The pending-grid model (spec §9 — RBAC v2 batch replace). The grid's local edits
 * accumulate in a `PendingPermissionMap` keyed by `"<resource>|<action>"`; "Save
 * changes" turns that map into the role's ENTIRE next grid, committed in one atomic
 * `PATCH /api/roles/:id/permissions` under a single `version` (FR-AUD-013/019). The
 * server diffs it against the current grid and audits the delta.
 */

export function cellKey(resource: string, action: string): string {
  return `${resource}|${action}`;
}

/** Split a `"<resource>|<action>"` key back into its parts (resource may contain dots, not `|`). */
export function splitKey(key: string): { resource: string; action: string } {
  const idx = key.lastIndexOf("|");
  return { resource: key.slice(0, idx), action: key.slice(idx + 1) };
}

/** Build the base pending map from a loaded role's current grants (the clean baseline). */
export function baseMapFromRole(role: RoleDetail): PendingPermissionMap {
  const map: PendingPermissionMap = {};
  for (const p of role.permissions) {
    map[cellKey(p.resource, p.action)] = { scope: p.projectScope, valueLimit: p.valueLimit };
  }
  return map;
}

/** True when the two cell states are equivalent (same grant presence, scope, limit). */
function cellsEqual(
  a: PendingCellEdit | null | undefined,
  b: PendingCellEdit | null | undefined,
): boolean {
  const ga = a ?? null;
  const gb = b ?? null;
  if (ga === null && gb === null) return true;
  if (ga === null || gb === null) return false;
  return ga.scope === gb.scope && String(ga.valueLimit ?? "") === String(gb.valueLimit ?? "");
}

/** True when `work` differs from `base` anywhere — the pending set or the approval limit. */
export function hasPendingChanges(
  base: PendingPermissionMap,
  work: PendingPermissionMap,
  baseApprovalLimit: string | null,
  workApprovalLimit: string | null,
): boolean {
  if (String(baseApprovalLimit ?? "") !== String(workApprovalLimit ?? "")) return true;
  const keys = new Set([...Object.keys(base), ...Object.keys(work)]);
  for (const k of keys) {
    if (!cellsEqual(base[k], work[k])) return true;
  }
  return false;
}

/** The count of changed cells (grid only, excluding the approval limit) — the Save-bar delta. */
export function changedCellCount(base: PendingPermissionMap, work: PendingPermissionMap): number {
  const keys = new Set([...Object.keys(base), ...Object.keys(work)]);
  let n = 0;
  for (const k of keys) {
    if (!cellsEqual(base[k], work[k])) n += 1;
  }
  return n;
}

/**
 * The full-set replace payload (spec §9): every granted cell in `work` becomes a
 * `PermissionInput`. Absent/`null` cells are simply omitted — the backend revokes
 * anything not in the list. On an unscoped role every grant is forced to `ALL`
 * (the UI never offers ASSIGNED there — ROLE_SCOPE_CONFLICT prevention).
 */
export function buildReplacePayload(
  work: PendingPermissionMap,
  isUnscopedRole: boolean,
): PermissionInput[] {
  const out: PermissionInput[] = [];
  for (const [key, cell] of Object.entries(work)) {
    if (!cell) continue;
    const { resource, action } = splitKey(key);
    out.push({
      resource,
      action,
      projectScope: isUnscopedRole ? "ALL" : cell.scope,
      valueLimit: cell.valueLimit,
    });
  }
  // Stable order (resource, then action) so the payload is deterministic for tests.
  out.sort((a, b) => a.resource.localeCompare(b.resource) || String(a.action).localeCompare(String(b.action)));
  return out;
}

/**
 * A grant narrows when it drops (present→absent) or is restricted (ALL→ASSIGNED, or
 * a value limit introduced/lowered). Drives the client-side Admin anti-lockout
 * disabling (FR-AUD-034) — the built-in Admin grid is edited only upward.
 */
export function narrows(base: PendingCellEdit | null, next: PendingCellEdit | null): boolean {
  if (base === null) return false; // wasn't granted → can't narrow
  if (next === null) return true; // revoked
  if (base.scope === "ALL" && next.scope === "ASSIGNED") return true;
  const baseLimit = base.valueLimit;
  const nextLimit = next.valueLimit;
  if (nextLimit !== null && (baseLimit === null || Number(nextLimit) < Number(baseLimit))) return true;
  return false;
}

/** Default cell for a freshly-granted permission on a role (scope follows the role mode). */
export function defaultCell(isUnscopedRole: boolean): PendingCellEdit {
  return { scope: isUnscopedRole ? "ALL" : "ASSIGNED", valueLimit: null };
}

/** Tri-state of a set of `(resource, action)` cells against the pending grid. */
export type TriState = "checked" | "mixed" | "unchecked";

export function triStateFor(keys: string[], work: PendingPermissionMap): TriState {
  if (keys.length === 0) return "unchecked";
  const granted = keys.filter((k) => work[k]).length;
  if (granted === 0) return "unchecked";
  if (granted === keys.length) return "checked";
  return "mixed";
}

/** The `(resource, action)` cells that carry a value limit, among a key set (bulk-clear warning). */
export function limitedCellCount(keys: string[], work: PendingPermissionMap): number {
  return keys.filter((k) => work[k]?.valueLimit != null).length;
}

export type { ProjectScope };
