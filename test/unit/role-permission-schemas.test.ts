/**
 * FE-18 role-permission-editor unit tests (FR-AUD-013/016/019). Covers the
 * limit validation, server-error mapping (spec §8 exact strings), and the
 * batch-diff builder — the one genuinely new pattern this screen introduces
 * (spec §9: pending-edit set -> minimal grant/revoke/update ops).
 */
import { ApiError } from "@/lib/api/errors";
import {
  isInvalidLimit,
  normaliseLimit,
  mapRolePermissionError,
  LIMIT_VALIDATION_MESSAGE,
  CONFLICT_MESSAGE,
  SCOPE_CLASH_MESSAGE,
  OFFLINE_MESSAGE,
} from "@/features/audit/schemas/role-permissions";
import {
  cellKey,
  baseMapFromRole,
  hasPendingChanges,
  changedCellCount,
  buildPermissionDiff,
} from "@/features/audit/schemas/permission-diff";
import { type RoleDetail, type PendingPermissionMap } from "@/features/audit/types";

describe("isInvalidLimit / normaliseLimit (SRS §11 — limits >= 0, Decimal(18,4))", () => {
  it("treats empty/undefined as valid (escalate-by-default, not zero)", () => {
    expect(isInvalidLimit("")).toBe(false);
    expect(isInvalidLimit("   ")).toBe(false);
    expect(isInvalidLimit(null)).toBe(false);
    expect(isInvalidLimit(undefined)).toBe(false);
  });

  it("accepts a non-negative decimal string", () => {
    expect(isInvalidLimit("0")).toBe(false);
    expect(isInvalidLimit("500000")).toBe(false);
    expect(isInvalidLimit("1234.5678")).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(isInvalidLimit("-1")).toBe(true);
  });

  it("rejects a non-numeric string", () => {
    expect(isInvalidLimit("abc")).toBe(true);
  });

  it("normalises blank input to null; trims otherwise", () => {
    expect(normaliseLimit("")).toBeNull();
    expect(normaliseLimit("   ")).toBeNull();
    expect(normaliseLimit(" 500000 ")).toBe("500000");
  });

  it("exposes the exact spec §8 validation message", () => {
    expect(LIMIT_VALIDATION_MESSAGE).toBe("Enter an amount of 0 or more.");
  });
});

describe("mapRolePermissionError (spec §8 exact strings)", () => {
  const of = (code: string) => new ApiError({ code, message: "x", details: null, status: 409 });

  it("maps OPTIMISTIC_LOCK_CONFLICT to the exact conflict banner copy", () => {
    const m = mapRolePermissionError(of("OPTIMISTIC_LOCK_CONFLICT"));
    expect(m.kind).toBe("optimisticLockConflict");
    expect(m.message).toBe(CONFLICT_MESSAGE);
    expect(m.message).toBe(
      "This role was changed by someone else. Reload to see the latest, then reapply your changes.",
    );
  });

  it("maps ROLE_SCOPE_CONFLICT to the exact unscoped-clash copy", () => {
    const m = mapRolePermissionError(of("ROLE_SCOPE_CONFLICT"));
    expect(m.kind).toBe("roleScopeConflict");
    expect(m.message).toBe(SCOPE_CLASH_MESSAGE);
    expect(m.message).toBe(
      "This role applies to all projects, so project scope can't be restricted.",
    );
  });

  it("maps NETWORK_ERROR to the exact offline copy", () => {
    const m = mapRolePermissionError(of("NETWORK_ERROR"));
    expect(m.kind).toBe("offline");
    expect(m.message).toBe(OFFLINE_MESSAGE);
  });

  it("maps DUPLICATE_PERMISSION distinctly (reconciled silently by the caller)", () => {
    const m = mapRolePermissionError(of("DUPLICATE_PERMISSION"));
    expect(m.kind).toBe("duplicatePermission");
  });

  it("maps FORBIDDEN to the exact 403 copy", () => {
    const m = mapRolePermissionError(of("FORBIDDEN"));
    expect(m.message).toBe("You don't have access to roles & permissions.");
  });
});

describe("permission batch-diff builder (spec §9)", () => {
  function role(overrides: Partial<RoleDetail> = {}): RoleDetail {
    return {
      id: "role-1",
      name: "PROJECT_MANAGER",
      approvalLimit: "500000",
      isUnscoped: false,
      version: 12,
      permissions: [
        {
          id: "p1",
          module: "PUR",
          action: "APPROVE",
          projectScope: "ASSIGNED",
          valueLimit: "200000",
        },
        { id: "p2", module: "REQ", action: "CREATE", projectScope: "ASSIGNED", valueLimit: null },
      ],
      ...overrides,
    };
  }

  it("cellKey joins module and action with a pipe", () => {
    expect(cellKey("PUR", "APPROVE")).toBe("PUR|APPROVE");
  });

  it("baseMapFromRole seeds one entry per existing grant", () => {
    const map = baseMapFromRole(role());
    expect(map["PUR|APPROVE"]).toEqual({ scope: "ASSIGNED", valueLimit: "200000" });
    expect(map["REQ|CREATE"]).toEqual({ scope: "ASSIGNED", valueLimit: null });
    expect(Object.keys(map)).toHaveLength(2);
  });

  it("hasPendingChanges is false when work matches base and the approval limit is unchanged", () => {
    const r = role();
    const base = baseMapFromRole(r);
    expect(hasPendingChanges(base, { ...base }, r.approvalLimit, r.approvalLimit)).toBe(false);
  });

  it("hasPendingChanges is true when the approval limit alone changes", () => {
    const r = role();
    const base = baseMapFromRole(r);
    expect(hasPendingChanges(base, { ...base }, r.approvalLimit, "600000")).toBe(true);
  });

  it("hasPendingChanges is true on a new grant, a revoke, or a scope/limit edit", () => {
    const r = role();
    const base = baseMapFromRole(r);

    const withNewGrant: PendingPermissionMap = {
      ...base,
      "GEN|POST": { scope: "ASSIGNED", valueLimit: null },
    };
    expect(hasPendingChanges(base, withNewGrant, r.approvalLimit, r.approvalLimit)).toBe(true);

    const withRevoke: PendingPermissionMap = { ...base, "REQ|CREATE": null };
    expect(hasPendingChanges(base, withRevoke, r.approvalLimit, r.approvalLimit)).toBe(true);

    const withScopeChange: PendingPermissionMap = {
      ...base,
      "PUR|APPROVE": { scope: "ALL", valueLimit: "200000" },
    };
    expect(hasPendingChanges(base, withScopeChange, r.approvalLimit, r.approvalLimit)).toBe(true);
  });

  it("changedCellCount counts only grid cells, not the approval limit", () => {
    const r = role();
    const base = baseMapFromRole(r);
    const work: PendingPermissionMap = {
      ...base,
      "REQ|CREATE": null, // revoke
      "GEN|POST": { scope: "ASSIGNED", valueLimit: null }, // grant
    };
    expect(changedCellCount(base, work)).toBe(2);
  });

  it("builds a grant op for a new cell (POST /api/permissions)", () => {
    const r = role();
    const work: PendingPermissionMap = {
      ...baseMapFromRole(r),
      "GEN|POST": { scope: "ASSIGNED", valueLimit: null },
    };
    const diff = buildPermissionDiff(r, work, r.approvalLimit);
    expect(diff.ops).toContainEqual({
      kind: "grant",
      module: "GEN",
      action: "POST",
      scope: "ASSIGNED",
      valueLimit: null,
    });
  });

  it("builds a revoke op for a removed cell (DELETE /api/permissions/:id)", () => {
    const r = role();
    const work: PendingPermissionMap = { ...baseMapFromRole(r), "REQ|CREATE": null };
    const diff = buildPermissionDiff(r, work, r.approvalLimit);
    expect(diff.ops).toContainEqual({ kind: "revoke", permissionId: "p2" });
  });

  it("builds an update op only for the changed field(s) (PATCH /api/permissions/:id)", () => {
    const r = role();
    const work: PendingPermissionMap = {
      ...baseMapFromRole(r),
      "PUR|APPROVE": { scope: "ALL", valueLimit: "200000" },
    };
    const diff = buildPermissionDiff(r, work, r.approvalLimit);
    expect(diff.ops).toContainEqual({
      kind: "update",
      permissionId: "p1",
      scope: "ALL",
      valueLimit: undefined,
    });
  });

  it("produces no op for an unchanged cell (minimal diff)", () => {
    const r = role();
    const diff = buildPermissionDiff(r, baseMapFromRole(r), r.approvalLimit);
    expect(diff.ops).toHaveLength(0);
    expect(diff.approvalLimitChanged).toBe(false);
  });

  it("flags approvalLimitChanged and carries the new value (PATCH /api/roles/:id)", () => {
    const r = role();
    const diff = buildPermissionDiff(r, baseMapFromRole(r), "750000");
    expect(diff.approvalLimitChanged).toBe(true);
    expect(diff.approvalLimit).toBe("750000");
  });

  it("treats null approvalLimit -> null as unchanged (escalate-by-default, not a diff)", () => {
    const r = role({ approvalLimit: null });
    const diff = buildPermissionDiff(r, baseMapFromRole(r), null);
    expect(diff.approvalLimitChanged).toBe(false);
  });
});
