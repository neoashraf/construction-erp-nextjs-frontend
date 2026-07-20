import { type DayStatus, type BiometricFeedRow } from "../api/attendance";

/**
 * Turns a dropped biometric file into the `BiometricFeedRow[]` the import endpoint expects
 * (FR-HR-004). Supports the three formats the panel advertises:
 *   • `.xlsx` — real Excel workbooks (e.g. a ZKTeco device export), read with SheetJS.
 *   • `.csv`  — comma/semicolon/tab-delimited text.
 *   • `.json` — a JSON array already in row shape (pass-through).
 *
 * The feed keys the employee by their human `employeeCode` (the machine/employee id on the
 * sheet, NOT a UUID) and carries no project — the project is applied once by the caller from
 * the roster's selected project. Headers are matched case-/punctuation-insensitively against
 * the alias map, so a device log with "Employee", "Date", "Checkin Time", "Checkout Time",
 * "Status" maps onto our field names. Times like "9:47:00 AM" are normalised to "09:47" and
 * statuses like "Late"/"Holiday"/"Absent" onto the DayStatus enum. A friendly `Error` is
 * thrown for anything we can't turn into rows so the panel can show it instead of crashing.
 */

type FeedField = "employeeCode" | "attendanceDate" | "checkIn" | "checkOut" | "dayStatus" | "overtimeHours";

/** Normalise a header cell to a bare alphanumeric key for alias lookup. */
function headerKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Maps normalised header keys onto our feed fields. First match wins. */
const FIELD_ALIASES: Record<FeedField, string[]> = {
  employeeCode: [
    "employeecode", "employeeid", "employee", "empid", "empcode",
    "userid", "user", "badgeid", "badge", "pin", "acno", "acnno",
    "machineid", "deviceid", "code", "id",
  ],
  attendanceDate: ["attendancedate", "date", "day", "workdate"],
  checkIn: ["checkintime", "checkin", "in", "timein", "intime", "clockin", "punchin", "firstpunch", "arrival"],
  checkOut: ["checkouttime", "checkout", "out", "timeout", "outtime", "clockout", "punchout", "lastpunch", "departure"],
  dayStatus: ["daystatus", "status", "attendance", "remark", "remarks"],
  overtimeHours: ["overtimehours", "overtime", "othours", "ot"],
};

const FEED_FIELDS = Object.keys(FIELD_ALIASES) as FeedField[];

function resolveHeaders(headers: string[]): Partial<Record<FeedField, number>> {
  const normalised = headers.map(headerKey);
  const map: Partial<Record<FeedField, number>> = {};
  const taken = new Set<number>();
  FEED_FIELDS.forEach((field) => {
    for (const alias of FIELD_ALIASES[field]) {
      const idx = normalised.indexOf(alias);
      if (idx !== -1 && !taken.has(idx)) {
        map[field] = idx;
        taken.add(idx);
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
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = dmy[1] ?? "";
    const m = dmy[2] ?? "";
    const y = dmy[3] ?? "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

/** Normalise a time cell ("9:47:00 AM", "09:47", a Date) to "HH:mm"; blank → null. */
function normaliseTime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/);
  if (!m) return s;
  let hour = Number(m[1]);
  const minute = m[2] ?? "00";
  const ampm = (m[3] ?? "").toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

const DAY_STATUS_ALIASES: Record<string, DayStatus> = {
  p: "PRESENT", present: "PRESENT", late: "PRESENT", l: "PRESENT", ot: "PRESENT", wfh: "PRESENT",
  a: "ABSENT", absent: "ABSENT",
  pl: "PAID_LEAVE", paidleave: "PAID_LEAVE", holiday: "PAID_LEAVE", h: "PAID_LEAVE", casualleave: "PAID_LEAVE",
  ul: "UNPAID_LEAVE", unpaidleave: "UNPAID_LEAVE", leave: "UNPAID_LEAVE", lwp: "UNPAID_LEAVE",
};

/**
 * Map a status cell to a DayStatus. Returns null when there's no status column at all so the
 * backend can apply its own default (PRESENT); an unrecognised non-empty value also defaults
 * to PRESENT rather than failing the whole import.
 */
function normaliseDayStatus(value: unknown): DayStatus | null {
  const raw = String(value ?? "").trim();
  if (raw === "") return null;
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  return DAY_STATUS_ALIASES[key] ?? "PRESENT";
}

function cellString(value: unknown): string {
  return String(value ?? "").trim();
}

/** Build a feed row from a header→index map and one data row's cells. */
function toRow(map: Partial<Record<FeedField, number>>, cells: unknown[]): BiometricFeedRow {
  const at = (field: FeedField) => (map[field] === undefined ? undefined : cells[map[field] as number]);
  return {
    employeeCode: cellString(at("employeeCode")),
    attendanceDate: normaliseDate(at("attendanceDate")),
    checkIn: normaliseTime(at("checkIn")),
    checkOut: normaliseTime(at("checkOut")),
    dayStatus: normaliseDayStatus(at("dayStatus")),
    overtimeHours: cellString(at("overtimeHours")) || null,
  };
}

/** Parse a matrix of rows (first row = headers) into BiometricFeedRow[]. */
function rowsFromMatrix(matrix: unknown[][]): BiometricFeedRow[] {
  const nonEmpty = matrix.filter((r) => r.some((c) => cellString(c) !== ""));
  const headerRow = nonEmpty[0];
  if (nonEmpty.length < 2 || !headerRow) {
    throw new Error("The file has no data rows. Include a header row and at least one record.");
  }
  const headers = headerRow.map((h) => cellString(h));
  const map = resolveHeaders(headers);
  if (map.employeeCode === undefined || map.attendanceDate === undefined) {
    throw new Error(
      "Couldn't find an employee and date column. Expected headers like " +
        "\"Employee\" (or \"Employee ID\") and \"Date\".",
    );
  }
  return nonEmpty
    .slice(1)
    .map((cells) => toRow(map, cells))
    .filter((r) => r.employeeCode !== "" && r.attendanceDate !== "");
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

function parseCsv(text: string): BiometricFeedRow[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].find((d) => firstLine.includes(d)) ?? ",";
  const matrix = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((line) => splitCsvLine(line, delimiter));
  return rowsFromMatrix(matrix);
}

async function parseXlsx(file: File): Promise<BiometricFeedRow[]> {
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

function parseJson(text: string): BiometricFeedRow[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of rows.");
  return parsed as BiometricFeedRow[];
}

/**
 * Parse a dropped/selected biometric file into rows. Routes by file extension; throws a
 * user-facing `Error` on anything that can't be turned into rows.
 */
export async function parseAttendanceFeed(file: File): Promise<BiometricFeedRow[]> {
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
