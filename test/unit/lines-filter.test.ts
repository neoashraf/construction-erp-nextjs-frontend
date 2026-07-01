/**
 * FE-11 account-ledger filter unit tests (FR-LED-031/007).
 * The date-range client validation and the account-ledger vs drill-down mode switch.
 */
import {
  linesFilterSchema,
  isAccountLedgerMode,
} from "@/features/ledger/schemas/lines-filter.schema";

describe("linesFilterSchema — dateFrom > dateTo (spec §7)", () => {
  it("accepts an empty filter (drill-down)", () => {
    expect(linesFilterSchema.safeParse({}).success).toBe(true);
  });
  it("accepts dateFrom <= dateTo", () => {
    expect(
      linesFilterSchema.safeParse({ dateFrom: "2025-04-01", dateTo: "2026-06-30" }).success,
    ).toBe(true);
  });
  it("rejects dateFrom after dateTo with the exact inline message", () => {
    const r = linesFilterSchema.safeParse({ dateFrom: "2026-06-30", dateTo: "2025-04-01" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.message)).toContain("Date from cannot be after date to.");
  });
});

describe("isAccountLedgerMode — running-balance gating (spec §5/§13)", () => {
  it("true only with account + both dates", () => {
    expect(isAccountLedgerMode({ accountId: "a1", dateFrom: "2025-04-01", dateTo: "2026-06-30" })).toBe(
      true,
    );
  });
  it("false without an account (drill-down)", () => {
    expect(isAccountLedgerMode({ dateFrom: "2025-04-01", dateTo: "2026-06-30" })).toBe(false);
    expect(isAccountLedgerMode({ projectId: "p1" } as never)).toBe(false);
  });
  it("false with an account but no date range", () => {
    expect(isAccountLedgerMode({ accountId: "a1" })).toBe(false);
    expect(isAccountLedgerMode({ accountId: "a1", dateFrom: "2025-04-01" })).toBe(false);
  });
});
