import {
  holidayTypeOf,
  sameWeekdaySet,
  summarizeHolidays,
  upcomingHolidays,
  WEEKDAY_ORDER,
} from "@/features/hr/lib/holiday-types";
import { datesForMode, initialDraft, selectableYears } from "@/features/hr/lib/attendance-filters";
import { type GovernmentHoliday } from "@/features/hr/api/holidays";

function holiday(overrides: Partial<GovernmentHoliday> = {}): GovernmentHoliday {
  return { id: "h1", date: "2026-03-26", name: "Independence Day", source: "public", ...overrides };
}

describe("holidayTypeOf", () => {
  it("classifies by source when it is explicit", () => {
    expect(holidayTypeOf(holiday({ source: "religious-feed" }))).toBe("Religious");
    expect(holidayTypeOf(holiday({ source: "manual" }))).toBe("Special");
    expect(holidayTypeOf(holiday({ source: "special-decl" }))).toBe("Special");
    expect(holidayTypeOf(holiday())).toBe("National");
  });

  it("recognises Eid and Puja by name, since the feed tags them generically", () => {
    expect(holidayTypeOf(holiday({ name: "Eid ul-Fitr", source: "public" }))).toBe("Religious");
    expect(holidayTypeOf(holiday({ name: "Durga Puja", source: "public" }))).toBe("Religious");
  });
});

describe("upcomingHolidays", () => {
  const today = new Date(2026, 5, 15); // 15 Jun 2026

  it("returns the next holidays on or after today", () => {
    const list = [
      holiday({ id: "a", date: "2026-03-26" }),
      holiday({ id: "b", date: "2026-07-01" }),
      holiday({ id: "c", date: "2026-08-15" }),
      holiday({ id: "d", date: "2026-09-20" }),
    ];
    expect(upcomingHolidays(list, 2, today).map((h) => h.id)).toEqual(["b", "c"]);
  });

  it("falls back to the start of the year when none remain", () => {
    const past = [holiday({ id: "a", date: "2026-01-01" }), holiday({ id: "b", date: "2026-02-21" })];
    expect(upcomingHolidays(past, 2, new Date(2026, 11, 31)).map((h) => h.id)).toEqual(["a", "b"]);
  });
});

describe("summarizeHolidays", () => {
  it("counts per type and estimates working days", () => {
    const list = [
      holiday({ id: "a", source: "public" }),
      holiday({ id: "b", name: "Eid ul-Adha" }),
      holiday({ id: "c", source: "manual" }),
    ];
    const summary = summarizeHolidays(list, 1);
    expect(summary.total).toBe(3);
    expect(summary.byType).toEqual({ National: 1, Religious: 1, Special: 1 });
    expect(summary.workingDays).toBe(365 - 3 - 52);
  });

  it("returns null — rendered as '—' — when the weekly count is unknown or zero", () => {
    // Unknown (query unresolved/failed): a defaulted zero would silently render ~104
    // extra working days as fact. Zero configured: the standing warning state; the card
    // must not show a 7-day-week "estimate" beside four exact figures.
    expect(summarizeHolidays([holiday()], null).workingDays).toBeNull();
    expect(summarizeHolidays([holiday()], 0).workingDays).toBeNull();
  });

  it("clamps at zero rather than reporting negative working days", () => {
    // 365 − 0 − (7 × 52) = 1, so a 7-day off-week alone stays positive…
    expect(summarizeHolidays([], 7).workingDays).toBe(1);
    // …and enough dated holidays on top of it hit the clamp instead of going negative.
    const many = Array.from({ length: 10 }, (_, i) =>
      holiday({ id: `h${i}`, date: `2026-01-${String(i + 1).padStart(2, "0")}` }),
    );
    expect(summarizeHolidays(many, 7).workingDays).toBe(0);
  });
});

describe("weekly off-days", () => {
  it("renders Monday-first while keeping JS weekday values", () => {
    expect(WEEKDAY_ORDER.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("compares selections order-insensitively", () => {
    expect(sameWeekdaySet([5, 0], [0, 5])).toBe(true);
    expect(sameWeekdaySet([5], [5, 0])).toBe(false);
  });
});

describe("selectableYears", () => {
  const today = new Date(2026, 6, 15);

  it("reaches several years forward, so a future calendar like 2028 is selectable", () => {
    const years = selectableYears(undefined, today);
    expect(years).toContain(2028);
    expect(years).toContain(2031);
  });

  it("reaches back for historical attendance", () => {
    expect(selectableYears(undefined, today)).toContain(2021);
  });

  it("includes a selected year that falls outside the default window", () => {
    // Otherwise the <select> would have no matching option and snap to another year.
    const years = selectableYears(2015, today);
    expect(years).toContain(2015);
    expect(years).toContain(2026);
  });

  it("never duplicates a selected year already inside the window", () => {
    const years = selectableYears(2026, today);
    expect(years.filter((y) => y === 2026)).toHaveLength(1);
  });

  it("lists newest first", () => {
    const years = selectableYears(undefined, today);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });
});

describe("datesForMode", () => {
  it("fills blank range bounds so the applied query is never date-less", () => {
    // A date-less range query makes the server fall back to "today", which renders
    // aggregate columns showing 1 working day for everyone.
    const result = datesForMode("range", { date: "", dateFrom: "", dateTo: "" });
    expect(result.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps bounds the user already chose", () => {
    const result = datesForMode("month", { date: "", dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(result.dateFrom).toBe("2026-02-01");
    expect(result.dateTo).toBe("2026-02-28");
  });

  it("defaults single mode to today when unset", () => {
    const result = datesForMode("single", { date: "", dateFrom: "", dateTo: "" });
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("starts on the current month with both bounds populated", () => {
    const draft = initialDraft(new Date(2026, 6, 15));
    expect(draft.mode).toBe("month");
    expect(draft.dateFrom).toBe("2026-07-01");
    expect(draft.dateTo).toBe("2026-07-31");
  });
});
