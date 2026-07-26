import {
  clampToToday,
  formatRelativeTime,
  formatTime,
  formatTimeWithSeconds,
  parseDateOnly,
  parseDeviceTimestamp,
  toIsoDate,
} from "@/features/hr/lib/attendance-time";

/**
 * These cover the two silent-corruption hazards the module exists to contain: the device's
 * non-ISO `"YYYY-MM-DD HH:mm:ss"` (which some browsers read as UTC) and date-only strings
 * (which ISO defines as UTC midnight, landing on the previous day west of Greenwich).
 * Both produce plausible-but-wrong dates rather than errors, so they need explicit tests.
 */
describe("parseDeviceTimestamp", () => {
  it("reads the device format as LOCAL wall-clock, not UTC", () => {
    const parsed = parseDeviceTimestamp("2026-07-03 09:15:42");
    expect(parsed).not.toBeNull();
    // Local getters must return exactly what the device wrote, in every timezone.
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(6);
    expect(parsed!.getDate()).toBe(3);
    expect(parsed!.getHours()).toBe(9);
    expect(parsed!.getMinutes()).toBe(15);
    expect(parsed!.getSeconds()).toBe(42);
  });

  it("accepts the ISO 'T' separator and a missing seconds field", () => {
    expect(parseDeviceTimestamp("2026-07-03T09:15")!.getHours()).toBe(9);
    expect(parseDeviceTimestamp("2026-07-03 09:15")!.getSeconds()).toBe(0);
  });

  it("returns null for empty or unparseable input rather than an Invalid Date", () => {
    expect(parseDeviceTimestamp(null)).toBeNull();
    expect(parseDeviceTimestamp("")).toBeNull();
    expect(parseDeviceTimestamp("not a date")).toBeNull();
  });
});

describe("parseDateOnly", () => {
  it("builds a local midnight, so the calendar day never shifts", () => {
    const parsed = parseDateOnly("2026-07-03");
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(6);
    expect(parsed!.getDate()).toBe(3);
    expect(parsed!.getHours()).toBe(0);
  });

  it("round-trips through toIsoDate", () => {
    expect(toIsoDate(parseDateOnly("2026-01-09")!)).toBe("2026-01-09");
  });
});

describe("formatTime", () => {
  it("renders hour and minute in 12-hour form", () => {
    expect(formatTime("2026-07-03 09:15:42")).toMatch(/^9:15\s?AM$/i);
  });

  it("adds seconds only in the drawer variant", () => {
    expect(formatTimeWithSeconds("2026-07-03 09:15:42")).toMatch(/^9:15:42\s?AM$/i);
  });

  it("shows a placeholder for a missing time", () => {
    expect(formatTime(null)).toBe("--");
    expect(formatTime(undefined)).toBe("--");
  });

  it("falls back to the raw value instead of throwing on junk", () => {
    expect(formatTime("garbage")).toBe("garbage");
  });
});

describe("clampToToday", () => {
  it("pulls a future end date back to today so the label matches measured data", () => {
    const future = "2999-12-31";
    const today = toIsoDate(new Date());
    expect(clampToToday(future)).toBe(today);
  });

  it("leaves a past date untouched", () => {
    expect(clampToToday("2020-01-15")).toBe("2020-01-15");
  });
});

describe("formatRelativeTime", () => {
  it("buckets by magnitude", () => {
    const now = Date.now();
    const at = (msAgo: number) => {
      const d = new Date(now - msAgo);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };
    expect(formatRelativeTime(at(5_000))).toBe("just now");
    expect(formatRelativeTime(at(5 * 60_000))).toBe("5m ago");
    expect(formatRelativeTime(at(3 * 3_600_000))).toBe("3h ago");
    expect(formatRelativeTime(at(2 * 86_400_000))).toBe("2d ago");
  });
});
