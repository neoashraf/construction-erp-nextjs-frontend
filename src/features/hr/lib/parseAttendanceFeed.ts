import { type DayStatus, type OfficeAttendanceRow } from "../api/attendance";

/**
 * Turns a dropped biometric file into the `OfficeAttendanceRow[]` the import endpoint
 * expects (FR-HR-004). Supports the three formats the panel advertises:
 *   • `.xlsx` — real Excel workbooks (e.g. a ZKTeco device export), read with SheetJS.
 *   • `.csv`  — comma/semicolon/tab-delimited text.
 *   • `.json` — a JSON array already in row shape (pass-through).
 *
 * Headers are matched case-/punctuation-insensitively against the alias map below, so a
 * device log with "Employee ID", "Date", "Time In", "Time Out" maps onto our field names.
 * A friendly `Error` is thrown for anything we can't turn into rows so the panel can show it
 * instead of crashing on `JSON.parse` (the old bug: an `.xlsx` is a binary ZIP, so reading it
 * as text produced gibberish that failed to parse).
 */

/** Normalise a header cell to a bare alphanumeric key for alias lookup. */
function headerKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Maps normalised header keys onto our row fields. First match wins. */
const FIELD_ALIASES: Record<keyof OfficeAttendanceRow, string[]> = {
  employeeId: [
    "employeeid", "employee", "empid", "empcode", "employeecode",
    "userid", "user", "badgeid", "badge", "pin", "acno", "acnno", "code",
  ],
  attendanceDate: ["attendancedate", "date", "day", "workdate"],
  projectId: ["projectid", "project", "projectcode", "site", "siteid"],
  dayStatus: ["daystatus", "status", "attendance", "remark", "remarks"],
  checkIn: ["checkin", "in", "timein", "intime", "clockin", "punchin", "firstpunch", "arrival"],
  checkOut: ["checkout", "out", "timeout", "outtime", "clockout", "punchout", "lastpunch", "departure"],
  overtimeHours: ["overtimehours", "overtime", "othours", "ot"],
};

function resolveHeaders(headers: string[]): Partial<Record<keyof OfficeAttendanceRow, number>> {
  const normalised = headers.map(headerKey);
  const map: Partial<Record<keyof OfficeAttendanceRow, number>> = {};
  (Object.keys(FIELD_ALIASES) as Array<keyof OfficeAttendanceRow>).forEach((field) => {
    for (const alias of FIELD_ALIASES[field]) {
      const idx = normalised.indexOf(alias);
      if (idx !== -1) {
        map[field] = idx;
        break;
      }
    }
  });
  return map;
}

/** Normalise a date cell (Date, DD/MM/YYYY, or YYYY-MM-DD) to YYYY-MM-DD. */
function normaliseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = dmy[1] ?? "";
    const m = dmy[2] ?? "";
    const y = dmy[3] ?? "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

const DAY_STATUS_ALIASES: Record<string, DayStatus> = {
  p: "PRESENT", present: "PRESENT",
  a: "ABSENT", absent: "ABSENT",
  pl: "PAID_LEAVE", paidleave: "PAID_LEAVE",
  ul: "UNPAID_LEAVE", unpaidleave: "UNPAID_LEAVE", leave: "UNPAID_LEAVE",
};

/** Map a status cell to a DayStatus; falls back to PRESENT when a punch exists. */
function normaliseDayStatus(value: unknown, hasPunch: boolean): DayStatus {
  const key = String(value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return DAY_STATUS_ALIASES[key] ?? (hasPunch ? "PRESENT" : "ABSENT");
}

function cellString(value: unknown): string {
  return String(value ?? "").trim();
}

/** Build a row from a header→index map and one data row's cells. */
function toRow(
  map: Partial<Record<keyof OfficeAttendanceRow, number>>,
  cells: unknown[],
): OfficeAttendanceRow {
  const at = (field: keyof OfficeAttendanceRow) =>
    map[field] === undefined ? undefined : cells[map[field] as number];

  const checkIn = cellString(at("checkIn")) || null;
  const checkOut = cellString(at("checkOut")) || null;
  const overtimeHours = cellString(at("overtimeHours")) || null;

  return {
    employeeId: cellString(at("employeeId")),
    attendanceDate: normaliseDate(at("attendanceDate")),
    projectId: cellString(at("projectId")),
    dayStatus: normaliseDayStatus(at("dayStatus"), Boolean(checkIn || checkOut)),
    checkIn,
    checkOut,
    overtimeHours,
  };
}

/** Parse a matrix of rows (first row = headers) into OfficeAttendanceRow[]. */
function rowsFromMatrix(matrix: unknown[][]): OfficeAttendanceRow[] {
  const nonEmpty = matrix.filter((r) => r.some((c) => cellString(c) !== ""));
  const headerRow = nonEmpty[0];
  if (nonEmpty.length < 2 || !headerRow) {
    throw new Error("The file has no data rows. Include a header row and at least one record.");
  }
  const headers = headerRow.map((h) => cellString(h));
  const map = resolveHeaders(headers);
  if (map.employeeId === undefined || map.attendanceDate === undefined) {
    throw new Error(
      "Couldn't find an employee and date column. Expected headers like " +
        "\"Employee ID\" and \"Date\".",
    );
  }
  return nonEmpty.slice(1).map((cells) => toRow(map, cells));
}

/** Split a CSV line honouring quoted fields. Delimiter is auto-detected per file. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): OfficeAttendanceRow[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].find((d) => firstLine.includes(d)) ?? ",";
  const matrix = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((line) => splitCsvLine(line, delimiter));
  return rowsFromMatrix(matrix);
}

async function parseXlsx(file: File): Promise<OfficeAttendanceRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error("The workbook has no sheets.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return rowsFromMatrix(matrix);
}

function parseJson(text: string): OfficeAttendanceRow[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of rows.");
  return parsed as OfficeAttendanceRow[];
}

/**
 * Parse a dropped/selected biometric file into rows. Routes by file extension; throws a
 * user-facing `Error` on anything that can't be turned into rows.
 */
export async function parseAttendanceFeed(file: File): Promise<OfficeAttendanceRow[]> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "xlsx" || ext === "xls") {
    return parseXlsx(file);
  }
  const text = await file.text();
  if (ext === "json") {
    return parseJson(text);
  }
  if (ext === "csv" || ext === "txt" || ext === "") {
    return parseCsv(text);
  }
  throw new Error(`Unsupported file type ".${ext}". Upload a CSV, XLSX, or JSON file.`);
}
