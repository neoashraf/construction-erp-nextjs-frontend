import { type AttendanceLogFilters, type ExportType } from "../api/attendance-logs";
import { firstDayOfMonth, lastDayOfMonth, toIsoDate } from "./attendance-time";

/**
 * Filter/date-mode rules for the attendance-logs screen.
 *
 * Pure functions only — the screen owns the state, this owns the decisions. Two rules
 * here are load-bearing and easy to regress:
 *
 *  - Switching to Month/Range must produce populated dates **immediately** (see
 *    `datesForMode`). If the mode flips while `dateFrom`/`dateTo` are still blank, the
 *    table renders aggregate columns but the request carries no range, so the server
 *    falls back to "today" and every employee shows 1 working day.
 *  - Export type and filter shape are independent choices, so a filter must be
 *    *translated* to fit the requested export rather than dropped (see `filtersForExport`).
 */

export type DateMode = "month" | "single" | "range";

/** Page size the screen starts on; widened when a multi-day window is selected. */
export const DEFAULT_PAGE_SIZE = 20;
/** A range/month covers more rows, so show more of them per page. */
export const RANGE_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];

/** What the user is currently editing, before pressing Apply. */
export interface FilterDraft {
  mode: DateMode;
  search: string;
  /** `YYYY-MM-DD`, single-day mode. */
  date: string;
  /** `YYYY-MM-DD`, range/month mode. */
  dateFrom: string;
  dateTo: string;
  summary: boolean;
}

export function initialDraft(today = new Date()): FilterDraft {
  return {
    mode: "month",
    search: "",
    date: toIsoDate(today),
    dateFrom: firstDayOfMonth(today),
    dateTo: lastDayOfMonth(today),
    summary: false,
  };
}

/**
 * The date bounds a mode implies, reusing what the user already picked where it still
 * applies and filling blanks with the current month. Called at the moment the mode
 * changes so the applied query is never left date-less.
 */
export function datesForMode(
  mode: DateMode,
  draft: Pick<FilterDraft, "date" | "dateFrom" | "dateTo">,
  today = new Date(),
): Pick<FilterDraft, "date" | "dateFrom" | "dateTo"> {
  if (mode === "single") {
    return { ...draft, date: draft.date || toIsoDate(today) };
  }
  return {
    ...draft,
    dateFrom: draft.dateFrom || firstDayOfMonth(today),
    dateTo: draft.dateTo || lastDayOfMonth(today),
  };
}

/** The bounds of the month containing `isoDate`. */
export function monthBounds(isoDate: string, today = new Date()): { dateFrom: string; dateTo: string } {
  const [y, m] = isoDate.split("-").map(Number);
  const anchor = y && m ? new Date(y, m - 1, 1) : today;
  return { dateFrom: firstDayOfMonth(anchor), dateTo: lastDayOfMonth(anchor) };
}

/**
 * Turn a draft into request filters.
 *
 * The search box is one field serving two server params: an all-digits term is an
 * employee id, anything else is a name. Empty params are omitted entirely rather than
 * sent blank.
 */
export function toRequestFilters(draft: FilterDraft): AttendanceLogFilters {
  const filters: AttendanceLogFilters = {};

  const term = draft.search.trim();
  if (term) {
    if (/^\d+$/.test(term)) filters.userId = term;
    else filters.name = term;
  }

  if (draft.mode === "single") {
    if (draft.date) filters.date = draft.date;
  } else {
    if (draft.dateFrom) filters.dateFrom = draft.dateFrom;
    if (draft.dateTo) filters.dateTo = draft.dateTo;
  }

  return filters;
}

/** True when the table should show aggregate columns rather than per-day ones. */
export function isRangeView(mode: DateMode): boolean {
  return mode !== "single";
}

/** True when anything deviates from defaults — drives whether Clear is offered. */
export function hasActiveFilters(draft: FilterDraft, initial: FilterDraft): boolean {
  return (
    draft.search.trim() !== "" ||
    draft.mode !== initial.mode ||
    draft.summary !== initial.summary ||
    draft.date !== initial.date ||
    draft.dateFrom !== initial.dateFrom ||
    draft.dateTo !== initial.dateTo
  );
}

/** The export type that best matches the current view — a suggestion, never a restriction. */
export function suggestedExportType(mode: DateMode, summary: boolean): ExportType {
  if (summary) return "summary";
  return isRangeView(mode) ? "range" : "daily";
}

/**
 * Translate the active filters to fit the requested export type.
 *
 * The user can pick any of the three exports regardless of the current view, so the
 * filters have to be reshaped rather than dropped: a single-day filter exported as a
 * range becomes a one-day range, and a range exported as daily uses its first date.
 * The reports API also rejects a half-open window, so a range with only one end supplied
 * is squared off by mirroring the value into the missing side.
 */
export function filtersForExport(
  type: ExportType,
  filters: AttendanceLogFilters,
): AttendanceLogFilters {
  const base: AttendanceLogFilters = {};
  if (filters.userId) base.userId = filters.userId;
  if (filters.name) base.name = filters.name;

  if (type === "daily") {
    const day = filters.date ?? filters.dateFrom ?? filters.dateTo;
    if (day) base.date = day;
    return base;
  }

  // summary + range both want a closed window.
  const from = filters.dateFrom ?? filters.date ?? filters.dateTo;
  const to = filters.dateTo ?? filters.date ?? filters.dateFrom;
  if (from) base.dateFrom = from;
  if (to) base.dateTo = to;
  return base;
}

/** `attendance-summary-2026-07-01_to_2026-07-26.xlsx`, or `-today` when undated. */
export function exportFilename(type: ExportType, filters: AttendanceLogFilters): string {
  const suffix = filters.date
    ? filters.date
    : filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom}_to_${filters.dateTo}`
      : (filters.dateFrom ?? filters.dateTo ?? "today");
  return `attendance-${type}-${suffix}.xlsx`;
}

/**
 * Selectable years for the month/year and holiday-calendar pickers.
 *
 * A fixed window around "now" is wrong for both ends: attendance is a historical record
 * that keeps growing backwards, and holiday calendars are published ahead of time, so a
 * user planning 2028 must be able to reach it. The range therefore spans several years
 * either side of today, and `selected` is folded in so a year arriving from saved state
 * or a URL can never be missing from its own dropdown (which would silently snap the
 * control to a different year).
 */
export function selectableYears(selected?: number, today = new Date()): number[] {
  const current = today.getFullYear();
  const years = new Set<number>();
  for (let y = current - 5; y <= current + 5; y += 1) years.add(y);
  if (selected && Number.isFinite(selected)) years.add(selected);
  return [...years].sort((a, b) => b - a);
}

/** Page numbers with ellipsis gaps: `1 … 4 5 6 … 20`. `null` marks a gap. */
export function pageItems(current: number, totalPages: number): (number | null)[] {
  if (totalPages <= 5) {
    return Array.from({ length: Math.max(totalPages, 0) }, (_, i) => i + 1);
  }
  const items: (number | null)[] = [1];
  if (current > 3) items.push(null);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p > 1 && p < totalPages) items.push(p);
  }
  if (current < totalPages - 2) items.push(null);
  items.push(totalPages);
  return items;
}
