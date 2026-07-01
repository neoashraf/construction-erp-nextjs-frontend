/**
 * FE-13 trial-balance filter unit tests (FR-LED-031/007). Client `dateFrom > dateTo`
 * validation (skipped once a period is selected — server-side precedence), the
 * `groupBy` default + csv join helper.
 */
import {
  trialBalanceFilterSchema,
  groupByToApi,
} from "@/features/ledger/schemas/trial-balance-filter.schema";

describe("trialBalanceFilterSchema — dateFrom > dateTo (spec §7/§9)", () => {
  it("accepts an empty filter (whole-FY default)", () => {
    expect(trialBalanceFilterSchema.safeParse({}).success).toBe(true);
  });
  it("accepts dateFrom <= dateTo", () => {
    expect(
      trialBalanceFilterSchema.safeParse({ dateFrom: "2025-04-01", dateTo: "2026-06-30" }).success,
    ).toBe(true);
  });
  it("rejects dateFrom after dateTo with the exact inline message", () => {
    const r = trialBalanceFilterSchema.safeParse({ dateFrom: "2026-06-30", dateTo: "2025-04-01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain("Date from cannot be after date to.");
    }
  });
  it("skips date-order validation once a period is selected (server: periodId wins)", () => {
    const r = trialBalanceFilterSchema.safeParse({
      periodId: "per-1",
      dateFrom: "2026-06-30",
      dateTo: "2025-04-01",
    });
    expect(r.success).toBe(true);
  });
});

describe("groupByToApi — csv join (API contract groupBy)", () => {
  it("defaults to 'account' when empty", () => {
    expect(groupByToApi([])).toBe("account");
  });
  it("joins multiple dimensions", () => {
    expect(groupByToApi(["account", "project", "cost_centre"])).toBe("account,project,cost_centre");
  });
});
