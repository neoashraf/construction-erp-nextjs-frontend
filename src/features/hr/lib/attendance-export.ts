/**
 * CSV → `.xlsx` conversion and download, plus spreadsheet parsing for the holiday import.
 *
 * `xlsx` is imported dynamically in every function here. It is a large, browser-only
 * dependency, and these paths run only on an explicit user action (Export / choose file),
 * so keeping it out of the route's initial bundle costs nothing and saves every user who
 * never exports. It must never be pulled into a server component.
 */

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
