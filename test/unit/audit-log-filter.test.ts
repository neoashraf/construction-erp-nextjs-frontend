/**
 * FE-20 audit-log filter schema unit tests (FR-AUD-026/027; screen spec §7).
 * Date-range client validation (`dateFrom > dateTo`) with the EXACT spec copy,
 * and the action enum accepting only the backend's valid filter actions.
 */
import {
  auditLogFilterSchema,
  EMPTY_AUDIT_LOG_FILTER,
} from "@/features/audit/schemas/audit-log-filter";
import { AUDIT_ACTIONS } from "@/features/audit/types";

describe("auditLogFilterSchema — dateFrom > dateTo (spec §7)", () => {
  it("accepts an empty filter", () => {
    const r = auditLogFilterSchema.safeParse(EMPTY_AUDIT_LOG_FILTER);
    expect(r.success).toBe(true);
  });

  it("accepts dateFrom <= dateTo", () => {
    const r = auditLogFilterSchema.safeParse({
      ...EMPTY_AUDIT_LOG_FILTER,
      dateFrom: "2025-04-01",
      dateTo: "2026-06-30",
    });
    expect(r.success).toBe(true);
  });

  it("rejects dateFrom after dateTo with the EXACT spec §8 microcopy", () => {
    const r = auditLogFilterSchema.safeParse({
      ...EMPTY_AUDIT_LOG_FILTER,
      dateFrom: "2026-06-30",
      dateTo: "2025-04-01",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("End date must be after start date.");
    }
  });

  it("accepts one-sided date (only from, or only to)", () => {
    expect(
      auditLogFilterSchema.safeParse({ ...EMPTY_AUDIT_LOG_FILTER, dateFrom: "2025-04-01" }).success,
    ).toBe(true);
    expect(
      auditLogFilterSchema.safeParse({ ...EMPTY_AUDIT_LOG_FILTER, dateTo: "2026-06-30" }).success,
    ).toBe(true);
  });
});

describe("auditLogFilterSchema — action enum", () => {
  it("accepts every known audit action", () => {
    for (const action of AUDIT_ACTIONS) {
      const r = auditLogFilterSchema.safeParse({ ...EMPTY_AUDIT_LOG_FILTER, actions: [action] });
      expect(r.success).toBe(true);
    }
  });

  it("rejects an unknown action value", () => {
    const r = auditLogFilterSchema.safeParse({
      ...EMPTY_AUDIT_LOG_FILTER,
      actions: ["NOT_AN_ACTION"],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a combinable multi-select of actions", () => {
    const r = auditLogFilterSchema.safeParse({
      ...EMPTY_AUDIT_LOG_FILTER,
      actions: ["UPDATE", "POST"],
    });
    expect(r.success).toBe(true);
  });
});
