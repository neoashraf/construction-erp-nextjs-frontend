import {
  type AttendanceDayRecord,
  type DailyReportRow,
  type LogEntry,
  type RangeReportRow,
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
  /**
   * The day's RESOLVED location, used as the fallback for a punch that states none of its own
   * (a device punch always does — a machine states no place). Optional: absent on aggregate
   * rows, where there is no single day to resolve.
   */
  dayLocation?: string | null;
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
    // Times come from the DAY RECORD first, then the top-level entry.
    //
    // On a single-day query the server returns the row as an aggregate: the top-level
    // `occurredAt`/`deviceTimestamp`/`receivedAt` are all null and the real times sit in
    // `attendanceRecords[0]`. Reading only the top level left check-in blank while check-out
    // (already read from the record) rendered — the two must resolve from the same place.
    checkIn:
      first?.checkInAt ??
      first?.occurredAt ??
      first?.deviceTimestamp ??
      entry.occurredAt ??
      entry.deviceTimestamp ??
      entry.receivedAt ??
      null,
    checkOut: first?.checkOutAt ?? null,
    records,
  };
}

/**
 * Map a `GET /reports/range` row — the office-staff review's per-employee row.
 *
 * Unlike `mapLogEntry`, every count arrives INLINE on the row (the contract puts them there,
 * not nested under `totals`), and `records[]` is GAP-FREE: every date in the window, holidays
 * and absences included, which is what lets the drawer render a real calendar without the
 * client inventing the missing days.
 */
export function mapRangeReportRow(row: RangeReportRow): EmployeeRow {
  const records = Array.isArray(row.records) ? row.records : [];
  return {
    key: row.id || row.userId,
    userId: row.userId,
    name: row.name,
    designation: row.designation,
    workingDays: toCount(row.workingDays),
    presentCount: toCount(row.presentCount),
    lateCount: toCount(row.lateCount),
    absentCount: toCount(row.absentCount),
    holidayCount: toCount(row.holidayCount),
    attendancePercent: Math.round(toCount(row.attendancePercentage)),
    // A range row aggregates many days, so there is no single day status to show; the table
    // renders aggregate columns in this view and never reads `status`.
    status: "",
    checkIn: null,
    checkOut: null,
    records,
  };
}

/**
 * Map a `GET /reports/daily` row — one employee on ONE date.
 *
 * The row is folded into a single-entry `records[]` so the drawer, which is written against
 * the day-record shape, works identically whichever report supplied the row. `punchCount: 0`
 * with a leave status is the FR-HR-004 second-branch day and is expected, not an error.
 */
export function mapDailyReportRow(row: DailyReportRow): EmployeeRow {
  const present = row.status === "Absent" ? 0 : 1;
  return {
    key: row.id || row.userId,
    userId: row.userId,
    name: row.name,
    designation: row.designation,
    workingDays: 1,
    presentCount: present,
    lateCount: row.status === "Late" ? 1 : 0,
    absentCount: present ? 0 : 1,
    holidayCount: row.status === "Holiday" ? 1 : 0,
    attendancePercent: present ? 100 : 0,
    status: row.status,
    checkIn: row.checkInAt ?? null,
    checkOut: row.checkOutAt ?? null,
    records: [
      {
        id: row.id || `${row.userId}-${row.attendanceDate}`,
        attendanceDate: row.attendanceDate,
        deviceTimestamp: null,
        occurredAt: null,
        receivedAt: null,
        checkInAt: row.checkInAt ?? null,
        checkOutAt: row.checkOutAt ?? null,
        status: row.status,
        punchCount: toCount(row.punchCount),
      },
    ],
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

/**
 * Source → badge: FOUR canonical values, THREE labels (spec §5; API `sourceType` table).
 *
 * `DEVICE_PUSH` (real-time punch) and `DEVICE_SYNC` (pulled by "Sync device") are both a
 * machine reporting, so both read **Machine** — the distinction is how we asked, not how the
 * attendance was captured, and it is not a distinction an operator can act on.
 *
 * Anything unlisted degrades to **Machine**, never a blank cell: push-path normalisation has
 * not fully landed, and an unrecognised source must fall back to the truthful general case
 * rather than to an empty cell that reads as missing data.
 *
 * The value is always READABLE TEXT — never colour alone (WCAG 2.1 AA; spec §10).
 */
export type SourceBadge = "Machine" | "Import" | "Manual";

export function sourceBadgeLabel(source: string | null | undefined): SourceBadge {
  switch (source) {
    case "EXCEL_IMPORT":
      return "Import";
    case "MANUAL":
      return "Manual";
    default:
      return "Machine";
  }
}

/** Badge tone per source label. Tone is decoration — `sourceBadgeLabel` carries the meaning. */
export function sourceBadgeTone(source: string | null | undefined): "info" | "accent" | "neutral" {
  switch (sourceBadgeLabel(source)) {
    case "Import":
      return "accent";
    case "Manual":
      return "neutral";
    default:
      return "info";
  }
}

/**
 * The distinct sources that fed a day, in a stable order, one tag per contributing path.
 *
 * A day fed by more than one path is the at-a-glance signal that a MERGE happened — the
 * office-punch-at-09:00 plus site-entry-at-14:00 case. Deduped by LABEL, not by raw value, so
 * a day carrying both `DEVICE_PUSH` and `DEVICE_SYNC` shows one "Machine" tag rather than two
 * identical ones.
 */
export function contributingSources(
  punches: Array<{ sourceType?: string | null }> | undefined,
  fallback?: string | null,
): SourceBadge[] {
  const labels = new Set<SourceBadge>();
  for (const punch of punches ?? []) {
    if (punch?.sourceType) labels.add(sourceBadgeLabel(punch.sourceType));
  }
  if (labels.size === 0) return [sourceBadgeLabel(fallback)];
  const order: SourceBadge[] = ["Machine", "Import", "Manual"];
  return order.filter((label) => labels.has(label));
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

/**
 * Badge tone for a status string. Anything unrecognised reads as Absent.
 *
 * The vocabulary is SIX values since 29/07/2026 (BE #46): `Present` · `Late` · `Absent` ·
 * `Holiday` · `Paid leave` · `Unpaid leave`. The reports now read `attendance_record` rather
 * than the punch log, so a timeless leave day arrives as its own status instead of being
 * inferred `Absent` from missing punches — which is what let the report and the payslip
 * disagree about a month.
 *
 * Paid leave is `info`, not `destructive`: payroll PAYS it, so colouring it like an absence
 * would contradict the salary sheet on the same figure. Unpaid leave is `warning` — deducted,
 * but declared rather than unexplained.
 */
export type AttendanceTone = "success" | "warning" | "info" | "destructive";

export function statusTone(status: string | null | undefined): AttendanceTone {
  switch ((status ?? "").toLowerCase()) {
    case "present":
      return "success";
    case "late":
      return "warning";
    case "holiday":
    case "paid leave":
      return "info";
    case "unpaid leave":
      return "warning";
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
