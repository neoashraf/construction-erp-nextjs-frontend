import { applyEdit, isAllowedNumericValue } from "@/lib/numeric-input";

/**
 * Unit-tests the keystroke-level numeric filter that backs `NumericInput` /
 * `NumericBareInput` / `MoneyInput`. This is the "digits only" gate: given the
 * value an edit WOULD produce, decide whether the edit may land. Intermediate
 * states on the path to a number (`""`, `"-"`, `"12."`, `".") are allowed;
 * final-form validation stays Zod's job.
 */
describe("isAllowedNumericValue", () => {
  describe("integer mode", () => {
    const c = { mode: "integer" as const };

    it("allows a run of digits", () => {
      expect(isAllowedNumericValue("123", c)).toBe(true);
      expect(isAllowedNumericValue("0", c)).toBe(true);
    });

    it("allows the empty intermediate (cleared field)", () => {
      expect(isAllowedNumericValue("", c)).toBe(true);
    });

    it("rejects letters and symbols", () => {
      expect(isAllowedNumericValue("12a", c)).toBe(false);
      expect(isAllowedNumericValue("1 2", c)).toBe(false);
      expect(isAllowedNumericValue("12$", c)).toBe(false);
    });

    it("rejects a decimal point", () => {
      expect(isAllowedNumericValue("12.3", c)).toBe(false);
      expect(isAllowedNumericValue("12.", c)).toBe(false);
    });

    it("rejects a sign unless allowNegative", () => {
      expect(isAllowedNumericValue("-5", c)).toBe(false);
      expect(isAllowedNumericValue("-5", { ...c, allowNegative: true })).toBe(true);
      expect(isAllowedNumericValue("-", { ...c, allowNegative: true })).toBe(true);
    });
  });

  describe("decimal mode", () => {
    const c = { mode: "decimal" as const };

    it("allows digits, one dot, and the mid-type states", () => {
      expect(isAllowedNumericValue("12.34", c)).toBe(true);
      expect(isAllowedNumericValue("12.", c)).toBe(true);
      expect(isAllowedNumericValue(".", c)).toBe(true);
      expect(isAllowedNumericValue(".5", c)).toBe(true);
      expect(isAllowedNumericValue("", c)).toBe(true);
    });

    it("rejects a second dot", () => {
      expect(isAllowedNumericValue("12.3.4", c)).toBe(false);
    });

    it("rejects letters, incl. scientific-notation 'e'", () => {
      expect(isAllowedNumericValue("12e3", c)).toBe(false);
      expect(isAllowedNumericValue("1.2x", c)).toBe(false);
    });

    it("enforces the decimal-place cap", () => {
      expect(isAllowedNumericValue("1.234", { ...c, decimalPlaces: 3 })).toBe(true);
      expect(isAllowedNumericValue("1.2345", { ...c, decimalPlaces: 3 })).toBe(false);
      expect(isAllowedNumericValue("1.2345", { ...c, decimalPlaces: 4 })).toBe(true);
    });

    it("allows unlimited fraction digits when no cap is set", () => {
      expect(isAllowedNumericValue("1.23456789", c)).toBe(true);
    });
  });

  describe("money framing (allowGrouping)", () => {
    const c = { mode: "decimal" as const, decimalPlaces: 4, allowGrouping: true };

    it("tolerates thousands separators, spaces, and ৳ on paste", () => {
      expect(isAllowedNumericValue("1,234.56", c)).toBe(true);
      expect(isAllowedNumericValue("৳ 1,234.5600", c)).toBe(true);
      expect(isAllowedNumericValue("1 234", c)).toBe(true);
    });

    it("does not count grouping chars toward the decimal-place cap", () => {
      // The ".5600" fraction is exactly 4 places once commas/spaces are ignored.
      expect(isAllowedNumericValue("12,34,567.5600", c)).toBe(true);
    });

    it("still rejects real non-numeric characters", () => {
      expect(isAllowedNumericValue("1,23a", c)).toBe(false);
    });
  });
});

describe("applyEdit", () => {
  it("inserts text at a collapsed caret", () => {
    // "12|3" typing "9" at index 2 → "1293"
    expect(applyEdit("123", 2, 2, "9")).toBe("1293");
  });

  it("replaces a selection", () => {
    // select "23" in "123" and type "9" → "19"
    expect(applyEdit("123", 1, 3, "9")).toBe("19");
  });

  it("models a deletion as an empty insert over the selection", () => {
    expect(applyEdit("123", 1, 2, "")).toBe("13");
  });

  it("models a paste over the whole field", () => {
    expect(applyEdit("5", 0, 1, "1,234.50")).toBe("1,234.50");
  });
});
