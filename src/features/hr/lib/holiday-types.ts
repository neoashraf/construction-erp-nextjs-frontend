import { type GovernmentHoliday } from "../api/holidays";
import { parseDateOnly } from "./attendance-time";

/**
 * Holiday classification and calendar summaries.
 *
 * The API returns provenance (`source`) but no category, so the display type is derived
 * client-side. This is presentation only — nothing server-side branches on it.
 */

export type HolidayType = "National" | "Religious" | "Special";

export const HOLIDAY_TYPES: HolidayType[] = ["National", "Religious", "Special"];

/** Canned blurb per type, shown in the table's description column. */
export const HOLIDAY_TYPE_DESCRIPTION: Record<HolidayType, string> = {
  National: "Government-declared national holiday",
  Religious: "Religious observance holiday",
  Special: "Company-declared or special holiday",
};

export const HOLIDAY_TYPE_TONE: Record<HolidayType, "info" | "accent" | "warning"> = {
  National: "info",
  Religious: "accent",
  Special: "warning",
};

/**
 * Derive a display type from the holiday's source and name.
 *
 * Religious is checked first and considers the *name* as well as the source, because the
 * upstream government feed tags Eid and Puja dates with a generic public-holiday source —
 * classifying by source alone would file every religious holiday as National.
 */
export function holidayTypeOf(holiday: Pick<GovernmentHoliday, "source" | "name">): HolidayType {
  const source = (holiday.source ?? "").toLowerCase();
  const name = (holiday.name ?? "").toLowerCase();

  if (source.includes("relig") || name.includes("eid") || name.includes("puja")) {
    return "Religious";
  }
  if (source.includes("manual") || source.includes("special")) {
    return "Special";
  }
  return "National";
}

/**
 * Provenance label for a holiday row — the one thing on the row that says what the next
 * year-end feed sync will do to it (a `manual` row is never overwritten by an import).
 * Rendered as readable text, never colour alone.
 */
export function holidaySourceLabel(source: string | null | undefined): "From feed" | "Entered by hand" {
  return (source ?? "").toLowerCase().includes("import") ? "From feed" : "Entered by hand";
}

/** Tooltip carried by "Entered by hand" — the standing proof of the manual-row protection. */
export const MANUAL_SOURCE_TOOLTIP = "The year-end import leaves this row alone.";

/** Weekday name for a `YYYY-MM-DD` string, e.g. "Friday". */
export function weekdayName(isoDate: string): string {
  const date = parseDateOnly(isoDate);
  if (!date) return "";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

/** True when the holiday is today or later — drives the "upcoming" list and status pill. */
export function isUpcoming(isoDate: string, today = new Date()): boolean {
  const date = parseDateOnly(isoDate);
  if (!date) return false;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return date.getTime() >= start.getTime();
}

/**
 * The next two holidays from today.
 *
 * When the year is already over, the first two of that year are shown instead — an empty
 * panel for a past year reads as "no data loaded" rather than "the year has ended".
 */
export function upcomingHolidays(
  holidays: GovernmentHoliday[],
  count = 2,
  today = new Date(),
): GovernmentHoliday[] {
  const ahead = holidays.filter((h) => isUpcoming(h.date, today));
  return (ahead.length > 0 ? ahead : holidays).slice(0, count);
}

/** Day-numbers grouped by month index (0–11), for the mini-calendar overview. */
export function holidayDaysByMonth(holidays: GovernmentHoliday[]): Record<number, number[]> {
  const map: Record<number, number[]> = {};
  for (const holiday of holidays) {
    const date = parseDateOnly(holiday.date);
    if (!date) continue;
    const month = date.getMonth();
    (map[month] ??= []).push(date.getDate());
  }
  for (const days of Object.values(map)) days.sort((a, b) => a - b);
  return map;
}

export interface HolidaySummary {
  total: number;
  byType: Record<HolidayType, number>;
  /**
   * Rough working-day estimate: 365 − dated holidays − (weekly off-days × 52), or `null`
   * when the card has no number it can stand behind: the weekly-off-days count is unknown
   * (query unresolved or failed — a defaulted zero would silently render ~104 extra
   * working days as fact), or zero off-days are configured (the standing warning state;
   * the comp's zero-off-days frame reads "—", and a 7-day-week "estimate" beside four
   * exact figures would be read as exact).
   */
  workingDays: number | null;
}

/**
 * Headline counts for the calendar panel. `workingDays` is an approximation by design — it
 * ignores leap years and holidays that fall on an existing weekly off-day, and is labelled
 * as approximate in the UI. The authoritative per-employee figure comes from the server.
 */
export function summarizeHolidays(
  holidays: GovernmentHoliday[],
  weeklyOffCount: number | null,
): HolidaySummary {
  const byType: Record<HolidayType, number> = { National: 0, Religious: 0, Special: 0 };
  for (const holiday of holidays) byType[holidayTypeOf(holiday)] += 1;
  return {
    total: holidays.length,
    byType,
    workingDays:
      weeklyOffCount == null || weeklyOffCount === 0
        ? null
        : Math.max(0, 365 - holidays.length - weeklyOffCount * 52),
  };
}

/** Weekday toggles rendered Monday-first, but carrying JS weekday values (Sun = 0). */
export const WEEKDAY_ORDER: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

/** Order-insensitive comparison, so Save can be disabled when nothing actually changed. */
export function sameWeekdaySet(a: number[], b: number[]): boolean {
  return [...a].sort().join(",") === [...b].sort().join(",");
}
