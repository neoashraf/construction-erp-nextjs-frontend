import {
  type RoleDetail,
  type PermissionRecord,
  type PendingPermissionMap,
  type PendingCellEdit,
  type PermissionBatchDiff,
  type PermissionDiffOp,
} from "../types";

/**
 * The batch-diff builder (spec §9 — the one genuinely new pattern this screen
 * introduces). The grid's local edits accumulate in a `PendingPermissionMap`
 * keyed by `"<module>|<action>"`; "Save changes" turns that pending set + the
 * loaded role's current grants into the minimal set of grant/revoke/patch
 * operations the batched mutation fires — each carrying the role's `version`
 * (FR-AUD-013/016/019).
 */

export function cellKey(module: string, action: string): string {
  return `${module}|${action}`;
}

/** Build the base pending map from a loaded role's current grants (the "clean" baseline). */
export function baseMapFromRole(role: RoleDetail): PendingPermissionMap {
  const map: PendingPermissionMap = {};
  for (const p of role.permissions) {
    map[cellKey(p.module, p.action)] = { scope: p.projectScope, valueLimit: p.valueLimit };
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

/** The count of changed cells (grid changes only, excluding the approval limit) — for the status text. */
export function changedCellCount(base: PendingPermissionMap, work: PendingPermissionMap): number {
  const keys = new Set([...Object.keys(base), ...Object.keys(work)]);
  let n = 0;
  for (const k of keys) {
    if (!cellsEqual(base[k], work[k])) n += 1;
  }
  return n;
}

/**
 * Build the ordered list of operations to commit `work` against `role` (whose
 * `permissions[]` gives each existing grant's id for revoke/update). Grants that
 * are new (no matching id) -> `grant` (`POST`); cells removed from `work` that had
 * an id -> `revoke` (`DELETE`); cells present in both with a changed scope/limit
 * -> `update` (`PATCH`). Unchanged cells produce no op (spec §9 — minimal diff).
 */
export function buildPermissionDiff(
  role: RoleDetail,
  work: PendingPermissionMap,
  workApprovalLimit: string | null,
): PermissionBatchDiff {
  const byKey = new Map<string, PermissionRecord>();
  for (const p of role.permissions) byKey.set(cellKey(p.module, p.action), p);

  const ops: PermissionDiffOp[] = [];
  const keys = new Set([...byKey.keys(), ...Object.keys(work)]);

  for (const key of keys) {
    const existing = byKey.get(key);
    const pending = work[key] ?? null;
    const [module = "", action = ""] = key.split("|");

    if (!existing && pending) {
      ops.push({
        kind: "grant",
        module,
        action,
        scope: pending.scope,
        valueLimit: pending.valueLimit,
      });
      continue;
    }
    if (existing && !pending) {
      ops.push({ kind: "revoke", permissionId: existing.id });
      continue;
    }
    if (existing && pending) {
      const scopeChanged = existing.projectScope !== pending.scope;
      const limitChanged = String(existing.valueLimit ?? "") !== String(pending.valueLimit ?? "");
      if (scopeChanged || limitChanged) {
        ops.push({
          kind: "update",
          permissionId: existing.id,
          scope: scopeChanged ? pending.scope : undefined,
          valueLimit: limitChanged ? pending.valueLimit : undefined,
        });
      }
    }
  }

  const approvalLimitChanged = String(role.approvalLimit ?? "") !== String(workApprovalLimit ?? "");

  return { ops, approvalLimitChanged, approvalLimit: workApprovalLimit };
}
