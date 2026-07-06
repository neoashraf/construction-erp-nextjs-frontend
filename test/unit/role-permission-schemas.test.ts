/**
 * FE-22 role-permission-editor unit tests (RBAC v2 · FR-AUD-013/016/019/034/035).
 * Limit validation, server-error mapping (spec §8 exact strings), and the batch
 * full-set replace builder + anti-lockout / bulk helpers — the resource-keyed
 * pending-grid model this v2 introduces (spec §9).
 */
import { ApiError } from "@/lib/api/errors";
import {
  isInvalidLimit,
  normaliseLimit,
  mapRolePermissionError,
  roleInUseMessage,
  LIMIT_VALIDATION_MESSAGE,
  CONFLICT_MESSAGE,
  SCOPE_CLASH_MESSAGE,
  ADMIN_LOCKOUT_MESSAGE,
  DUPLICATE_ROLE_NAME_MESSAGE,
  SYSTEM_ROLE_IMMUTABLE_MESSAGE,
  OFFLINE_MESSAGE,
} from "@/features/audit/schemas/role-permissions";
import {
  cellKey,
  splitKey,
  baseMapFromRole,
  hasPendingChanges,
  changedCellCount,
  buildReplacePayload,
  narrows,
  triStateFor,
  limitedCellCount,
  defaultCell,
} from "@/features/audit/schemas/permission-diff";
import { type RoleDetail, type PendingPermissionMap } from "@/features/audit/types";

describe("isInvalidLimit / normaliseLimit (SRS §11 — limits >= 0, Decimal(18,4))", () => {
  it("treats empty/undefined as valid (escalate-by-default, not zero)", () => {
    expect(isInvalidLimit("")).toBe(false);
    expect(isInvalidLimit(null)).toBe(false);
    expect(isInvalidLimit(undefined)).toBe(false);
  });
  it("accepts a non-negative decimal, rejects negatives and non-numerics", () => {
    expect(isInvalidLimit("500000")).toBe(false);
    expect(isInvalidLimit("1234.5678")).toBe(false);
    expect(isInvalidLimit("-1")).toBe(true);
    expect(isInvalidLimit("abc")).toBe(true);
  });
  it("normalises blank to null; trims otherwise", () => {
    expect(normaliseLimit("")).toBeNull();
    expect(normaliseLimit(" 500000 ")).toBe("500000");
  });
  it("exposes the exact validation message", () => {
    expect(LIMIT_VALIDATION_MESSAGE).toBe("Enter an amount of 0 or more.");
  });
});

describe("mapRolePermissionError (spec §8 exact strings)", () => {
  const of = (code: string) => new ApiError({ code, message: "x", details: null, status: 409 });

  it("maps the RBAC v2 error codes to their exact copy", () => {
    expect(mapRolePermissionError(of("OPTIMISTIC_LOCK_CONFLICT"))).toEqual({
      kind: "optimisticLockConflict",
      message: CONFLICT_MESSAGE,
    });
    expect(mapRolePermissionError(of("ROLE_SCOPE_CONFLICT")).message).toBe(SCOPE_CLASH_MESSAGE);
    expect(mapRolePermissionError(of("ADMIN_LOCKOUT_FORBIDDEN"))).toEqual({
      kind: "adminLockout",
      message: ADMIN_LOCKOUT_MESSAGE,
    });
    expect(mapRolePermissionError(of("DUPLICATE_ROLE_NAME")).message).toBe(DUPLICATE_ROLE_NAME_MESSAGE);
    expect(mapRolePermissionError(of("SYSTEM_ROLE_IMMUTABLE")).message).toBe(SYSTEM_ROLE_IMMUTABLE_MESSAGE);
    expect(mapRolePermissionError(of("ROLE_IN_USE")).kind).toBe("roleInUse");
    expect(mapRolePermissionError(of("NETWORK_ERROR")).message).toBe(OFFLINE_MESSAGE);
    expect(mapRolePermissionError(of("FORBIDDEN")).message).toBe("You don't have access to roles & permissions.");
  });

  it("roleInUseMessage names the count with correct pluralisation", () => {
    expect(roleInUseMessage(1)).toBe("This role is assigned to 1 user. Reassign them before deleting.");
    expect(roleInUseMessage(3)).toBe("This role is assigned to 3 users. Reassign them before deleting.");
  });
});

describe("resource-keyed pending grid (spec §9)", () => {
  function role(overrides: Partial<RoleDetail> = {}): RoleDetail {
    return {
      id: "role-1",
      name: "PROJECT_MANAGER",
      isSystem: true,
      approvalLimit: "500000",
      isUnscoped: false,
      userCount: 2,
      version: 12,
      permissions: [
        { id: "p1", resource: "purchase.orders", action: "APPROVE", projectScope: "ASSIGNED", valueLimit: "200000" },
        { id: "p2", resource: "requisitions.list", action: "CREATE", projectScope: "ASSIGNED", valueLimit: null },
      ],
      ...overrides,
    };
  }

  it("cellKey/splitKey round-trip a dotted resource + action", () => {
    const key = cellKey("cost_control.profitability", "READ");
    expect(key).toBe("cost_control.profitability|READ");
    expect(splitKey(key)).toEqual({ resource: "cost_control.profitability", action: "READ" });
  });

  it("baseMapFromRole seeds one entry per grant, keyed by resource|action", () => {
    const map = baseMapFromRole(role());
    expect(map["purchase.orders|APPROVE"]).toEqual({ scope: "ASSIGNED", valueLimit: "200000" });
    expect(map["requisitions.list|CREATE"]).toEqual({ scope: "ASSIGNED", valueLimit: null });
    expect(Object.keys(map)).toHaveLength(2);
  });

  it("hasPendingChanges / changedCellCount track grid + approval-limit deltas", () => {
    const r = role();
    const base = baseMapFromRole(r);
    expect(hasPendingChanges(base, { ...base }, r.approvalLimit, r.approvalLimit)).toBe(false);
    expect(hasPendingChanges(base, { ...base }, r.approvalLimit, "600000")).toBe(true);
    const work: PendingPermissionMap = {
      ...base,
      "requisitions.list|CREATE": null, // revoke
      "contra_journal.vouchers|POST": { scope: "ASSIGNED", valueLimit: null }, // grant
    };
    expect(changedCellCount(base, work)).toBe(2);
  });

  it("buildReplacePayload emits every granted cell (full-set replace), sorted, omitting nulls", () => {
    const work: PendingPermissionMap = {
      "requisitions.list|CREATE": { scope: "ASSIGNED", valueLimit: null },
      "purchase.orders|APPROVE": { scope: "ASSIGNED", valueLimit: "200000" },
      "sales.ipcs|READ": null, // revoked → omitted
    };
    const payload = buildReplacePayload(work, false);
    expect(payload).toEqual([
      { resource: "purchase.orders", action: "APPROVE", projectScope: "ASSIGNED", valueLimit: "200000" },
      { resource: "requisitions.list", action: "CREATE", projectScope: "ASSIGNED", valueLimit: null },
    ]);
  });

  it("buildReplacePayload forces ALL scope on an unscoped role (ROLE_SCOPE_CONFLICT prevention)", () => {
    const work: PendingPermissionMap = { "sales.ipcs|READ": { scope: "ASSIGNED", valueLimit: null } };
    expect(buildReplacePayload(work, true)[0]!.projectScope).toBe("ALL");
  });

  it("narrows detects revoke, ALL→ASSIGNED, and a limit introduced/lowered (anti-lockout)", () => {
    expect(narrows({ scope: "ALL", valueLimit: null }, null)).toBe(true); // revoke
    expect(narrows({ scope: "ALL", valueLimit: null }, { scope: "ASSIGNED", valueLimit: null })).toBe(true);
    expect(narrows({ scope: "ALL", valueLimit: null }, { scope: "ALL", valueLimit: "100" })).toBe(true); // introduced
    expect(narrows({ scope: "ALL", valueLimit: "200" }, { scope: "ALL", valueLimit: "100" })).toBe(true); // lowered
    expect(narrows({ scope: "ALL", valueLimit: null }, { scope: "ALL", valueLimit: null })).toBe(false); // unchanged
    expect(narrows(null, { scope: "ALL", valueLimit: null })).toBe(false); // adding is not narrowing
  });

  it("triStateFor + limitedCellCount drive the bulk toggles", () => {
    const keys = ["a|READ", "a|CREATE", "a|UPDATE"];
    expect(triStateFor(keys, {})).toBe("unchecked");
    expect(triStateFor(keys, { "a|READ": defaultCell(false) })).toBe("mixed");
    expect(
      triStateFor(keys, {
        "a|READ": defaultCell(false),
        "a|CREATE": defaultCell(false),
        "a|UPDATE": defaultCell(false),
      }),
    ).toBe("checked");
    expect(
      limitedCellCount(keys, {
        "a|READ": { scope: "ASSIGNED", valueLimit: "100" },
        "a|CREATE": defaultCell(false),
      }),
    ).toBe(1);
  });
});
