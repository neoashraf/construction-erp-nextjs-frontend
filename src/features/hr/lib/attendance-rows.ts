import {
  type AttendanceDayRecord,
  type LogEntry,
  type SummaryReportRow,
} from "../api/attendance-logs";

/**
 * Normalisation of the two attendance data sources into one row shape.
 *
 * `/logs` and `/reports/summary` answer with different objects but drive the same table,
 * so both are mapped to `EmployeeRow` here rather than branching inside the table. Keeping
 * the fallback chains in one place also keeps them auditable — several are load-bearing:
 * the device omits fields rather than sending nulls, so a missing `workingDays` is normal,
 * not an error.
 */

/** Attendance below this percentage is flagged as low in the table and drawer. */
export const LOW_ATTENDANCE_THRESHOLD = 85;

export interface EmployeeRow {
  /** Stable React key — the source row id, falling back to the userId. */
  key: string;
  userId: string;
  name: string | null;
  designation: string | null;
  workingDays: number;
  /** NB: includes late days (server semantics) — never sum present + late. */
  presentCount: number;
  lateCount: number;
  absentCount: number;
  holidayCount: number;
  /** Rounded integer 0–100. */
  attendancePercent: number;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  /** Per-day detail for the drawer; always empty for a summary row. */
  records: AttendanceDayRecord[];
}

function toCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Map a `/logs` row. The endpoint serves both single-day and aggregate queries, so most
 * count fields are optional and each needs a defined fallback.
 */
export function mapLogEntry(entry: LogEntry): EmployeeRow {
  const records = entry.attendanceRecords ?? [];
  const present = toCount(entry.presentCount);
  const absent = toCount(entry.absentCount);

  // The server omits workingDays on single-day queries; present + absent reconstructs it.
  const workingDays = toCount(entry.workingDays ?? present + absent);

  // Prefer the server's percentage — it knows the late-after rule and holiday exclusions.
  const attendancePercent =
    typeof entry.attendancePercentage === "number"
      ? Math.round(entry.attendancePercentage)
      : workingDays > 0
        ? Math.round((present / workingDays) * 100)
        : 0;

  // Older feeds omit holidayCount; recover it from the day records.
  const holidayCount =
    typeof entry.holidayCount === "number"
      ? entry.holidayCount
      : records.filter((r) => r.status === "Holiday" || Boolean(r.holidayName)).length;

  const first = records[0];

  return {
    key: entry.id || entry.userId,
    userId: entry.userId,
    name: entry.name,
    designation: entry.designation ?? null,
    workingDays,
    presentCount: present,
    lateCount: toCount(entry.lateCount),
    absentCount: absent,
    holidayCount,
    attendancePercent,
    status: entry.status ?? first?.status ?? "Absent",
    // The device populates whichever of these it has; take the most specific first.
    checkIn: entry.occurredAt ?? entry.deviceTimestamp ?? entry.receivedAt ?? null,
    checkOut: first?.checkOutAt ?? null,
    records,
  };
}

/**
 * Map a `/reports/summary` row. Summary rows are pre-aggregated and carry no per-day
 * detail, so `records` is empty and the drawer is suppressed for them. Status is a coarse
 * derivation — there is no single day to report on.
 */
export function mapSummaryRow(row: SummaryReportRow): EmployeeRow {
  const absent = toCount(row.absentCount);
  return {
    key: row.id || row.userId,
    userId: row.userId,
    name: row.name,
    designation: row.designation,
    workingDays: toCount(row.workingDays),
    presentCount: toCount(row.presentCount),
    lateCount: toCount(row.lateCount),
    absentCount: absent,
    holidayCount: toCount(row.holidayCount),
    attendancePercent: Math.round(toCount(row.attendancePercentage)),
    status: absent > 0 ? "Absent" : "Present",
    checkIn: null,
    checkOut: null,
    records: [],
  };
}

/** Fallbacks so a nameless device record still renders something meaningful. */
export const UNNAMED = "Unnamed";
export const NO_DESIGNATION = "No designation set";

/**
 * Initials for the avatar: first letter of each of the first two words. Falls back to the
 * first two characters of the userId when the name is missing or punctuation-only, so the
 * chip is never blank.
 */
export function initialsFor(name: string | null | undefined, userId: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  if (letters) return letters.toUpperCase();
  return (userId || "?").slice(0, 2).toUpperCase();
}

/**
 * A stable hue (0–359) for an employee's avatar, derived from the userId so the same
 * person keeps the same colour across pages, filters and reloads.
 *
 * The `* 137` step is essential, not decorative: user ids here are short sequential
 * numbers ("1".."20"), and a plain polynomial hash maps those onto a narrow band of
 * neighbouring hues — every avatar comes out near-identical. 137° is the golden angle, so
 * successive ids land far apart on the colour wheel and stay visually distinguishable.
 */
export function hueFor(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 131 + userId.charCodeAt(i)) >>> 0;
  }
  return (hash * 137) % 360;
}

/** Badge tone for a device status string. Anything unrecognised reads as Absent. */
export type AttendanceTone = "success" | "warning" | "info" | "destructive";

export function statusTone(status: string | null | undefined): AttendanceTone {
  switch ((status ?? "").toLowerCase()) {
    case "present":
      return "success";
    case "late":
      return "warning";
    case "holiday":
      return "info";
    default:
      return "destructive";
  }
}

/** Display label for a status, defaulting to Absent for unknown/blank values. */
export function statusLabel(status: string | null | undefined): string {
  const raw = (status ?? "").trim();
  if (!raw) return "Absent";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
