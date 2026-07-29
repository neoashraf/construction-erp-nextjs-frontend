/**
 * CSV → `.xlsx` conversion and download, plus spreadsheet parsing for the holiday import.
 *
 * `xlsx` is imported dynamically in every function here. It is a large, browser-only
 * dependency, and these paths run only on an explicit user action (Export / choose file),
 * so keeping it out of the route's initial bundle costs nothing and saves every user who
 * never exports. It must never be pulled into a server component.
 */

import { type ImportRow } from "../api/attendance-logs";
import { type ImportHolidayRow } from "../api/holidays";

/** Trigger a browser download for a Blob, cleaning up the object URL afterwards. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Convert the API's CSV to a real `.xlsx` workbook and download it.
 *
 * The caller strips the UTF-8 BOM (see `fetchExportCsv`) — if it survives to here it ends
 * up inside the first header cell, so the first column arrives in Excel with a garbled name.
 */
export async function downloadCsvAsXlsx(csv: string, filename: string): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(csv, { type: "string", raw: false });
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}

/** Column aliases accepted by the holiday import, normalised (lowercased, alphanumeric only). */
const DATE_HEADERS = ["date", "holidaydate"];
const NAME_HEADERS = ["holidayname", "name", "title"];
const LOCAL_NAME_HEADERS = ["localname"];

/** Strip everything but letters/digits so "Holiday Date", "holiday_date" and "HolidayDate" match. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.includes(normalizeHeader(key))) return value;
  }
  return undefined;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Coerce a spreadsheet date cell to `YYYY-MM-DD`.
 *
 * Three forms turn up in practice and all must be handled: a real `Date` (SheetJS with
 * `cellDates`), an Excel serial number (a date-formatted cell SheetJS didn't convert), or
 * a plain string someone typed. Returns null when the value is none of those.
 */
async function normalizeDateCell(value: unknown): Promise<string | null> {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const XLSX = await import("xlsx");
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return null;
}

export class HolidayImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HolidayImportError";
  }
}

const EXPECTED_COLUMNS =
  'Expected columns: "Date" (or "Holiday Date"), "Holiday Name" (or "Name"/"Title"), and optionally "Local Name".';

/**
 * Parse the first sheet of a holiday workbook into import rows.
 *
 * Rows missing *both* a date and a name are treated as trailing blanks and skipped
 * silently. A row with one but not the other is a genuine mistake in the file, so the
 * whole import is rejected — a partial import of a holiday calendar is worse than none,
 * because the gaps show up later as wrong attendance counts.
 */
export async function parseHolidayWorkbook(file: File): Promise<ImportHolidayRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new HolidayImportError("That file has no readable sheets.");

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const rows: ImportHolidayRow[] = [];
  for (const entry of raw) {
    const dateCell = pick(entry, DATE_HEADERS);
    const nameCell = pick(entry, NAME_HEADERS);
    const localCell = pick(entry, LOCAL_NAME_HEADERS);

    const name = nameCell == null ? "" : String(nameCell).trim();
    const hasDateCell = dateCell != null && String(dateCell).trim() !== "";

    // Blank filler row — ignore rather than fail the file.
    if (!hasDateCell && !name) continue;

    const date = await normalizeDateCell(dateCell);
    if (!date || !name) {
      throw new HolidayImportError(
        `Row ${rows.length + 1} is missing a valid date or holiday name. ${EXPECTED_COLUMNS}`,
      );
    }

    const localName = localCell == null ? "" : String(localCell).trim();
    rows.push({ date, name, localName: localName || null });
  }

  if (rows.length === 0) {
    throw new HolidayImportError(`No holiday rows found. ${EXPECTED_COLUMNS}`);
  }
  return rows;
}

// ── Attendance import ──

/** Column aliases accepted by the attendance import, normalised the same way as above. */
const USER_ID_HEADERS = ["userid", "employeeid", "employeecode", "id", "pin", "empid", "code"];
const ATT_DATE_HEADERS = ["date", "attendancedate", "day"];
const CHECK_IN_HEADERS = ["checkin", "intime", "in", "entry", "arrival"];
const CHECK_OUT_HEADERS = ["checkout", "outtime", "out", "exit", "departure"];
/**
 * Location aliases. OPTIONAL — a sheet without the column parses exactly as before, which is
 * what keeps every existing file and every raw machine dump working untouched.
 *
 * "site" and "project" are accepted alongside "location" because that is what a site clerk
 * actually writes at the top of a hand-kept entry log; the server resolves whatever string
 * arrives against the project master by code first, then name.
 */
const LOCATION_HEADERS = ["location", "site", "project", "projectcode", "worklocation", "place"];

export class AttendanceImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceImportError";
  }
}

const EXPECTED_ATTENDANCE_COLUMNS =
  'Expected columns: "Employee ID", "Date", "Check In", "Check Out", and optionally "Location".';

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Coerce a time cell to `HH:mm:ss`.
 *
 * Excel stores a time as a FRACTION OF A DAY (09:30 → 0.39583…), so a column formatted as
 * time arrives here as a number, not the text the user sees in the grid. Reading it as a
 * string would send "0.3958333333333333" to the server and every row would be rejected as an
 * invalid time — the single most likely way this import could appear broken while the file
 * looks perfectly correct on screen.
 *
 * With `cellDates: true` SheetJS may also hand back a `Date` (on the 1899-12-30 epoch for a
 * bare time), so that case is read for its clock components only.
 */
function normalizeTimeCell(value: unknown): string {
  if (value == null || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Keep only the time-of-day part: a cell formatted as date+time carries whole days too.
    const fraction = value - Math.floor(value);
    // Round to the nearest second before splitting — the fraction is a binary approximation,
    // so 09:30 can arrive as 09:29:59.9998 and truncate to 09:29:59.
    const total = Math.round(fraction * 86400);
    const seconds = total % 60;
    const minutes = Math.floor(total / 60) % 60;
    const hours = Math.floor(total / 3600) % 24;
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  const raw = String(value).trim();
  if (!raw) return "";

  // "9:05 AM" / "5:30 pm" — Excel exports and hand-typed cells both produce this.
  const meridiem = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/.exec(raw);
  if (meridiem) {
    const [, h, m, s, half] = meridiem;
    let hour = Number(h) % 12;
    if (half?.toLowerCase() === "p") hour += 12;
    return `${pad2(hour)}:${m}:${s ?? "00"}`;
  }

  // Plain 24-hour text. Padded to the same `HH:mm:ss` the numeric branch produces, so the
  // preview shows exactly what will be stored regardless of how the cell was formatted.
  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (clock) {
    const [, h, m, s] = clock;
    return `${pad2(Number(h))}:${m}:${s ?? "00"}`;
  }

  // Anything else is passed through untouched for the SERVER to judge. Silently discarding a
  // cell we do not recognise would drop the row without ever telling the user which one.
  return raw;
}

/**
 * Parse the first sheet of an attendance workbook into import rows.
 *
 * Only structural problems throw (no sheet, no recognisable columns, no rows) — those make
 * the whole file unusable. Per-row problems are deliberately NOT judged here: the rows go to
 * the server, which validates them and reports the offending sheet row numbers. One parser,
 * one set of rules, one place to fix them.
 */
export async function parseAttendanceWorkbook(file: File): Promise<ImportRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new AttendanceImportError("That file has no readable sheets.");

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (raw.length === 0) {
    throw new AttendanceImportError(`That sheet has no data rows. ${EXPECTED_ATTENDANCE_COLUMNS}`);
  }

  // Verify the columns exist BEFORE mapping. Without this, a file whose headers we don't
  // recognise yields hundreds of blank rows and the server reports "row 2, row 3, row 4…
  // Employee ID is required" — technically true, but it hides the real problem, which is
  // that the header row is wrong.
  const headerRow = raw[0] ?? {};
  const headers = Object.keys(headerRow).map(normalizeHeader);
  const hasUserId = headers.some((h) => USER_ID_HEADERS.includes(h));
  const hasDate = headers.some((h) => ATT_DATE_HEADERS.includes(h));
  if (!hasUserId || !hasDate) {
    const missing = [!hasUserId ? '"Employee ID"' : null, !hasDate ? '"Date"' : null]
      .filter(Boolean)
      .join(" and ");
    throw new AttendanceImportError(
      `Could not find the ${missing} column. ${EXPECTED_ATTENDANCE_COLUMNS}`,
    );
  }

  const rows: ImportRow[] = [];
  for (const entry of raw) {
    const userId = pick(entry, USER_ID_HEADERS);
    const dateCell = pick(entry, ATT_DATE_HEADERS);
    const checkIn = pick(entry, CHECK_IN_HEADERS);
    const checkOut = pick(entry, CHECK_OUT_HEADERS);
    const locationCell = pick(entry, LOCATION_HEADERS);

    // A date cell has the same three forms as the holiday import (Date / serial / text), and
    // `normalizeDateCell` already handles all three.
    const date = (await normalizeDateCell(dateCell)) ?? String(dateCell ?? "").trim();

    // Trimmed but otherwise untouched — the SERVER resolves it against the project master by
    // code then name. Matching it here would put a second, divergent resolver in the browser.
    // A blank cell omits the field entirely rather than sending "", so the row falls through
    // the device-default → employee-default chain exactly as a sheet with no column does.
    const location = locationCell == null ? "" : String(locationCell).trim();

    const row: ImportRow = {
      userId: userId == null ? "" : String(userId).trim(),
      date,
      checkIn: normalizeTimeCell(checkIn),
      checkOut: normalizeTimeCell(checkOut),
    };
    if (location) row.location = location;
    rows.push(row);
  }

  return rows;
}

/**
 * Download a blank attendance template.
 *
 * Times are written as TEXT (`"09:05"`, not a time-formatted cell) so the file round-trips
 * through the parser above unambiguously and, more importantly, so a user reading the
 * template sees the exact format the import expects rather than whatever their locale
 * renders a time cell as.
 *
 * **The header row here and the parser's accepted columns must change together.** A template
 * whose own columns the parser rejects is the first thing a new branch-office user meets, and
 * it reads as "the import is broken" at the exact moment they are deciding whether to trust
 * it. `test/unit/attendance-template-roundtrip.test.ts` asserts the round-trip; treat a
 * failure there as a contract change, not a test to fix.
 *
 * The sample rows deliberately span **two dates and two employees**, with one site code, one
 * office code and one BLANK Location — so the file itself teaches the three things a reader
 * would otherwise have to be told: a sheet may cover any span, each row carries its own date,
 * and Location is optional.
 */
export async function downloadAttendanceTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Employee ID", "Date", "Check In", "Check Out", "Location"],
    ["1001", "2026-07-01", "09:05", "18:10", "HO"],
    ["1002", "2026-07-01", "08:58", "18:02", "BRIDGE-04"],
    ["1001", "2026-07-02", "09:45", "18:15", ""],
  ]);
  // Widen the columns — the default is narrow enough to show "#####" for the dates, which
  // reads as a broken template.
  sheet["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "attendance-import-template.xlsx",
  );
}

/** Download a blank template so users can see the expected columns. */
export async function downloadHolidayTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Date", "Holiday Name", "Local Name"],
    ["2026-02-21", "International Mother Language Day", "আন্তর্জাতিক মাতৃভাষা দিবস"],
    ["2026-03-26", "Independence Day", "স্বাধীনতা দিবস"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Holidays");
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "holiday-import-template.xlsx",
  );
}
