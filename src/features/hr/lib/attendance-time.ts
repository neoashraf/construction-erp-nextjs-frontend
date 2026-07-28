/**
 * Date/time handling for the biometric attendance feed.
 *
 * Two parsing hazards this module exists to contain — both produce silently wrong dates
 * rather than errors, so neither is caught by types or tests that only check "it renders":
 *
 *  1. The device emits `"YYYY-MM-DD HH:mm:ss"` (a space, no `T`, no zone). That is not
 *     valid ISO-8601, and browsers disagree on it — some read it as UTC, some as local.
 *     It is always *local wall-clock* at the device, so we match the shape explicitly and
 *     build the Date from components.
 *  2. `new Date("2026-07-03")` — a date-only string — IS valid ISO and is defined to parse
 *     as **UTC midnight**. Rendered in a negative-offset timezone that displays as the 2nd.
 *     Date-only strings are therefore also split and built from components.
 *
 * Everything here is defensive: a malformed value returns null (or the raw string from a
 * formatter) rather than throwing, because this data originates from a hardware device.
 *
 * Note the app-wide `lib/format.ts` helpers are deliberately UTC-based — they serve
 * ISO-8601 stored timestamps. Device wall-clock is a different domain, hence local
 * construction here.
 */

/** `2026-07-03 09:15:42` — the device's wall-clock format. */
const DEVICE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
/** `2026-07-03` — a date-only string. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Rendered in place of a missing time. */
export const NO_TIME = "--";

/**
 * Parse a device timestamp as **local** time. Falls back to the native parser only when
 * the value doesn't match the device shape (e.g. a real ISO string with a zone offset,
 * which the native parser handles correctly).
 */
export function parseDeviceTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const m = DEVICE_TIMESTAMP.exec(raw);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      s ? Number(s) : 0,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dateOnly = parseDateOnly(raw);
  if (dateOnly) return dateOnly;

  const native = new Date(raw);
  return Number.isNaN(native.getTime()) ? null : native;
}

/** Parse `YYYY-MM-DD` into a **local** midnight Date (never UTC — see module note 2). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = DATE_ONLY.exec(String(value).trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Serialise a Date to `YYYY-MM-DD` using its **local** components. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatClock(value: string | null | undefined, withSeconds: boolean): string {
  if (!value) return NO_TIME;
  try {
    const date = parseDeviceTimestamp(value);
    if (!date) return String(value);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      ...(withSeconds ? { second: "2-digit" } : {}),
      hour12: true,
    });
  } catch {
    // Never let a display helper take the screen down over one bad device row.
    return String(value);
  }
}

/** `9:15 AM` — the table's time cells. */
export function formatTime(value: string | null | undefined): string {
  return formatClock(value, false);
}

/**
 * `9:15:42 AM` — the drawer's time cells. Seconds are shown there because the day is
 * already the row heading, so the extra precision is the only new information.
 */
export function formatTimeWithSeconds(value: string | null | undefined): string {
  return formatClock(value, true);
}

/** `03/07/2026` — matches the app-wide DD/MM/YYYY convention (CLAUDE.md §Conventions). */
export function formatDayLabel(value: string | null | undefined): string {
  if (!value) return NO_TIME;
  const date = parseDateOnly(value) ?? parseDeviceTimestamp(value);
  if (!date) return String(value);
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

/** `Jul 03` — compact form for range labels. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseDateOnly(value) ?? parseDeviceTimestamp(value);
  if (!date) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

/** First day of `date`'s month, as `YYYY-MM-DD`. */
export function firstDayOfMonth(date: Date): string {
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

/** Last day of `date`'s month, as `YYYY-MM-DD` (day 0 of the next month). */
export function lastDayOfMonth(date: Date): string {
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/**
 * Clamp a range end to today.
 *
 * The server only counts days that have actually happened, so an un-clamped label like
 * "Jul 01 – Jul 31" mid-month would advertise days that were never measured and make the
 * working-day count look wrong. Clamping keeps the label honest about the data behind it.
 */
export function clampToToday(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const date = parseDateOnly(isoDate);
  if (!date) return isoDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime() ? toIsoDate(today) : isoDate;
}

/** Human label for the active scope, e.g. `Jul 01 – Jul 26` or `03/07/2026`. */
export function describeScope(filters: {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}): string {
  if (filters.date) return formatDayLabel(filters.date);
  if (filters.dateFrom || filters.dateTo) {
    const from = formatShortDate(filters.dateFrom);
    const to = formatShortDate(clampToToday(filters.dateTo));
    if (from && to) return from === to ? from : `${from} – ${to}`;
    return from || to;
  }
  return "All dates";
}

/**
 * Coarse relative time for the last-sync hint: "just now" / "5m ago" / "3h ago" / "2d ago".
 * Deliberately not a live ticker — it is re-read whenever sync status is refetched.
 */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseDeviceTimestamp(value);
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
