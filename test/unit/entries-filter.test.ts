/**
 * FE-10 journal-entries filter unit tests (FR-LED-031).
 * The date-range client validation (`dateFrom > dateTo`) and the tri-state reversal
 * toggle → API `isReversal` mapping.
 */
import {
  entriesFilterSchema,
  reversalToApi,
} from "@/features/ledger/schemas/entries-filter.schema";
import { entryStatus } from "@/features/ledger/types";

describe("entriesFilterSchema — dateFrom > dateTo (spec §7)", () => {
  it("accepts an empty filter (default reversal=all)", () => {
    const r = entriesFilterSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reversal).toBe("all");
  });

  it("accepts dateFrom <= dateTo", () => {
    const r = entriesFilterSchema.safeParse({ dateFrom: "2025-04-01", dateTo: "2026-06-30" });
    expect(r.success).toBe(true);
  });

  it("rejects dateFrom after dateTo with the exact inline message", () => {
    const r = entriesFilterSchema.safeParse({ dateFrom: "2026-06-30", dateTo: "2025-04-01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("Date from cannot be after date to.");
    }
  });

  it("accepts one-sided date (only from, or only to)", () => {
    expect(entriesFilterSchema.safeParse({ dateFrom: "2025-04-01" }).success).toBe(true);
    expect(entriesFilterSchema.safeParse({ dateTo: "2026-06-30" }).success).toBe(true);
  });
});

describe("reversalToApi (tri-state → API isReversal)", () => {
  it("maps all → undefined, normal → false, reversal → true", () => {
    expect(reversalToApi("all")).toBeUndefined();
    expect(reversalToApi("normal")).toBe(false);
    expect(reversalToApi("reversal")).toBe(true);
  });
});

describe("entryStatus (FR-LED-026)", () => {
  it("derives reversal / reversed / normal (reversal takes precedence)", () => {
    expect(entryStatus({ isReversal: true, isReversed: false })).toBe("reversal");
    expect(entryStatus({ isReversal: false, isReversed: true })).toBe("reversed");
    expect(entryStatus({ isReversal: false, isReversed: false })).toBe("normal");
    expect(entryStatus({ isReversal: true, isReversed: true })).toBe("reversal");
  });
});
