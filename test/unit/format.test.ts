import {
  formatDate,
  formatDateTime,
  parseDate,
  isE164,
  isBangladeshPhone,
  formatPhone,
  toBangladeshE164,
} from "@/lib/format";

describe("format — BD localization", () => {
  it("renders dates DD/MM/YYYY (UTC)", () => {
    expect(formatDate("2026-06-29T00:00:00Z")).toBe("29/06/2026");
    expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe("05/01/2026");
  });

  it("renders timestamps DD/MM/YYYY HH:mm (24h UTC)", () => {
    expect(formatDateTime("2026-06-29T14:05:00Z")).toBe("29/06/2026 14:05");
  });

  it("parses DD/MM/YYYY and rejects bad input", () => {
    expect(parseDate("29/06/2026").toISOString()).toBe("2026-06-29T00:00:00.000Z");
    expect(() => parseDate("2026-06-29")).toThrow();
    expect(() => parseDate("31/02/2026")).toThrow(); // invalid calendar date
  });

  it("validates E.164 phones", () => {
    expect(isE164("+8801712345678")).toBe(true);
    expect(isE164("01712345678")).toBe(false);
    expect(isBangladeshPhone("+8801712345678")).toBe(true);
    expect(isBangladeshPhone("+11234567890")).toBe(false);
  });

  it("formats (passes through) a valid E.164 number, throws otherwise", () => {
    expect(formatPhone("+8801712345678")).toBe("+8801712345678");
    expect(() => formatPhone("01712345678")).toThrow();
  });

  it("normalizes a BD local number to E.164", () => {
    expect(toBangladeshE164("01712345678")).toBe("+8801712345678");
    expect(toBangladeshE164("017-1234 5678")).toBe("+8801712345678");
    expect(toBangladeshE164("+8801712345678")).toBe("+8801712345678");
    expect(() => toBangladeshE164("12345")).toThrow();
  });
});
