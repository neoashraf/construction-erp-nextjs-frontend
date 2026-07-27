import Decimal from "decimal.js";
import {
  formatMoney,
  formatMoneyOr,
  formatQty,
  parseMoney,
  parseQty,
  isNonNegativeMoney,
  TAKA,
} from "@/lib/money";

describe("money — exact decimal (no float)", () => {
  it("formats Decimal(18,4) with ৳, thousands, and 4 fraction digits", () => {
    expect(formatMoney("1234567.89")).toBe(`${TAKA} 1,234,567.8900`);
    expect(formatMoney("0")).toBe(`${TAKA} 0.0000`);
    expect(formatMoney("-5000")).toBe(`${TAKA} -5,000.0000`);
  });

  it("formats without the symbol when asked", () => {
    expect(formatMoney("100", { withSymbol: false })).toBe("100.0000");
  });

  it("groups in BD lakh/crore style when asked (dashboard KPIs)", () => {
    // last three digits, then twos: 48,20,000 — matches the dashboard design file.
    expect(formatMoney("4820000", { grouping: "lakh", fractionDigits: 2 })).toBe(`${TAKA} 48,20,000.00`);
    expect(formatMoney("8215000", { grouping: "lakh", fractionDigits: 2 })).toBe(`${TAKA} 82,15,000.00`);
    expect(formatMoney("36450000", { grouping: "lakh", fractionDigits: 2, withSymbol: false })).toBe("3,64,50,000.00");
    expect(formatMoney("-5000", { grouping: "lakh", fractionDigits: 2, withSymbol: false })).toBe("-5,000.00");
    // small values and default western grouping are unaffected.
    expect(formatMoney("486", { grouping: "lakh", fractionDigits: 2, withSymbol: false })).toBe("486.00");
    expect(formatMoney("4820000", { fractionDigits: 2, withSymbol: false })).toBe("4,820,000.00");
  });

  it("rounds half-up exactly — a case JS float gets wrong", () => {
    // 1.005 in IEEE-754 is 1.00499999...; toFixed(2) gives "1.00". decimal.js gives 1.01.
    expect(formatMoney("1.005", { fractionDigits: 2, withSymbol: false })).toBe("1.01");
    // The classic 0.1 + 0.2 float trap: exact decimal addition is 0.3, never 0.30000000000000004.
    expect(new Decimal("0.1").plus("0.2").toString()).toBe("0.3");
  });

  it("handles large 18-digit values without precision loss", () => {
    expect(formatMoney("99999999999999.9999", { withSymbol: false })).toBe("99,999,999,999,999.9999");
  });

  it("formats quantities at scale 3, no currency", () => {
    expect(formatQty("1234.5")).toBe("1,234.500");
    expect(formatQty("0.001")).toBe("0.001");
  });

  it("parses money strings (with symbol/commas) to a normalized Decimal(18,4)", () => {
    expect(parseMoney(`${TAKA} 1,234.56`).toString()).toBe("1234.56");
    expect(parseMoney("1000").toString()).toBe("1000");
    expect(parseMoney("1.23456").toString()).toBe("1.2346"); // rounded to scale 4
  });

  it("parses quantity strings to scale 3", () => {
    expect(parseQty("1,234.5").toString()).toBe("1234.5");
    expect(parseQty("0.0009").toString()).toBe("0.001");
  });

  it("throws on non-numeric money/qty input", () => {
    expect(() => parseMoney("abc")).toThrow();
    expect(() => parseMoney("")).toThrow();
    expect(() => parseQty("--")).toThrow();
  });

  it("validates non-negative money", () => {
    expect(isNonNegativeMoney("0")).toBe(true);
    expect(isNonNegativeMoney("10.5")).toBe(true);
    expect(isNonNegativeMoney("-1")).toBe(false);
    expect(isNonNegativeMoney("nope")).toBe(false);
  });

  it("names the offending value when a money amount is missing", () => {
    // decimal.js would otherwise throw a bare "Invalid argument: undefined", which gives
    // no clue which field the API omitted.
    expect(() => formatMoney(undefined as unknown as string)).toThrow(/not a valid money amount/i);
    expect(() => formatMoney(null as unknown as string)).toThrow(/not a valid money amount/i);
    expect(() => formatMoney("")).toThrow(/not a valid money amount/i);
  });

  it("formatMoneyOr renders a fallback instead of throwing on an absent amount", () => {
    expect(formatMoneyOr(undefined)).toBe("—");
    expect(formatMoneyOr(null)).toBe("—");
    expect(formatMoneyOr("")).toBe("—");
    expect(formatMoneyOr("bad")).toBe("—");
    expect(formatMoneyOr(undefined, "0.00")).toBe("0.00");
  });

  it("formatMoneyOr formats a present amount exactly like formatMoney", () => {
    expect(formatMoneyOr("1234.5", "—", { fractionDigits: 2 })).toBe(`${TAKA} 1,234.50`);
    expect(formatMoneyOr("0", "—", { fractionDigits: 2 })).toBe(`${TAKA} 0.00`);
  });
});
