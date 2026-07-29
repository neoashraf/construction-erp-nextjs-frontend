import { apiClient } from "@/lib/api/client";
import { type ReportParams } from "../../types";
import {
  type AttendanceDailyRow,
  type AttendanceRangeRow,
  type AttendanceReportTotals,
  type AttendanceSourceLabel,
  type AttendanceUnreconciled,
} from "../types";

/**
 * FE-66 — the Daily / Range readers for HR's own attendance report routes.
 *
 * These two routes are **HR-owned** (`AttendanceReportController`, contract 12
 * § "Attendance reports"), not RPT's, and carry the documented **whole-body
 * envelope exception**: the body is `{ totals, data, pagination }` with no
 * `{ data, meta }` wrapper and no `meta.requestId`, and they page on `limit`,
 * not `pageSize`. They therefore cannot pass through FE-54's `runReport`
 * unchanged — this file adapts them to the same `{ rows, meta }` shape every
 * viewer reads, exactly as the brief's Scope 13 permits ("adapt them in
 * `features/reports/hr/`"). FE-54's shared foundation is imported, never forked,
 * and this never reaches across into `features/hr/api/`.
 *
 * Nothing here computes a percentage or a total. Both come from the server or
 * they do not render (FR-RPT-004).
 */

/** The `{ totals, data, pagination }` body both routes return. */
interface HrEnvelope<Row> {
  data?: Row[];
  totals?: Record<string, unknown>;
  pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
  lateAfter?: string;
  unreconciled?: AttendanceUnreconciled;
  /** `range` only — the clamped window the server actually read. */
  dateFrom?: string;
  dateTo?: string;
  label?: string;
  totalDays?: number;
  totalWorkingDays?: number;
  /** `daily` only. */
  date?: string;
  isHoliday?: boolean;
  holiday?: { name?: string; type?: string } | null;
}

/** What the viewer consumes, whichever level produced it. */
export interface AttendanceLevelResult<Row> {
  rows: Row[];
  totals: AttendanceReportTotals | null;
  page: number;
  pageSize: number;
  total: number;
  generatedAt: string;
  unreconciled: AttendanceUnreconciled | null;
  /** Present when the server clamped the window to today (spec §9). */
  clampedTo: string | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
/** A percentage is rendered ONLY when the server actually sent one. */
const pct = (v: unknown): number | null => (typeof v === "number" ? v : null);

/**
 * The four canonical `sourceType` values collapse onto the three badge labels the
 * design shows. Anything unlisted degrades to "Machine" rather than a blank cell —
 * the same mapping the capture screen uses (Attendance capture §5).
 */
function sourceLabel(raw: unknown): AttendanceSourceLabel | null {
  const punches = Array.isArray(raw) ? (raw as Raw[]) : [];
  if (punches.length === 0) return null;
  const first = str(punches[0]?.sourceType);
  if (first === "MANUAL") return "Manual";
  if (first === "EXCEL_IMPORT") return "Import";
  return "Machine";
}

/** `"2026-07-12 09:47:00"` / `"9:47:00 AM"` → `HH:mm`; a timeless day stays null. */
export function toHhMm(at: unknown, display: unknown): string | null {
  const raw = str(at);
  if (raw) {
    const m = /(\d{1,2}):(\d{2})/.exec(raw.includes(" ") ? raw.slice(raw.indexOf(" ") + 1) : raw);
    if (m) return `${m[1]!.padStart(2, "0")}:${m[2]}`;
  }
  const d = str(display);
  if (!d) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(d.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const suffix = m[3]?.toUpperCase();
  if (suffix === "PM" && h < 12) h += 12;
  if (suffix === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * Report-wide totals, mapped from the server's own vocabulary
 * (`presentCount`/`absentCount`/…). Returns `null` when the server sent none —
 * the band then does not render at all. A wrong number is worse than a missing
 * one, so there is deliberately no fallback path here.
 */
function toTotals(raw: Raw | undefined, scopeNote?: string): AttendanceReportTotals | null {
  if (!raw || typeof raw !== "object") return null;
  const has =
    "presentCount" in raw || "absentCount" in raw || "present" in raw || "absent" in raw;
  if (!has) return null;
  return {
    present: num(raw.presentCount ?? raw.present),
    paidLeave: num(raw.paidLeaveCount ?? raw.paidLeave),
    unpaidLeave: num(raw.unpaidLeaveCount ?? raw.unpaidLeave),
    absent: num(raw.absentCount ?? raw.absent),
    attendancePercentage: pct(raw.attendancePercentage),
    scopeNote,
  };
}

function queryFor(params: ReportParams, level: "daily" | "range"): string {
  const q = new URLSearchParams();
  const extras = params.extras ?? {};
  if (level === "daily") {
    // A single-date Daily read uses `date`; a Daily read over a window uses the
    // range bounds — the route accepts `date` and defaults to today without it.
    const date = (extras.date as string | undefined) ?? "";
    if (date) q.set("date", date);
    else {
      if (params.dateFrom) q.set("dateFrom", params.dateFrom);
      if (params.dateTo) q.set("dateTo", params.dateTo);
    }
  } else {
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);
  }
  // `userId` is the employee CODE on these routes, not the UUID.
  const userId = (extras.userId as string | undefined) ?? (extras.employeeId as string | undefined);
  if (userId) q.set("userId", userId);
  const name = extras.name as string | undefined;
  if (name) q.set("name", name);
  const page = extras.page as number | string | undefined;
  if (page) q.set("page", String(page));
  // These routes page on `limit`, NOT `pageSize` (envelope exception).
  const limit = extras.limit as number | string | undefined;
  if (limit) q.set("limit", String(limit));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * DAILY — one row per employee-day. `range` is the gap-free calendar, so a Daily
 * view over a window flattens its per-employee `records[]`; a single date comes
 * back already flat from `/reports/daily`.
 */
export async function runAttendanceDaily(
  params: ReportParams,
): Promise<AttendanceLevelResult<AttendanceDailyRow>> {
  const singleDate = (params.extras?.date as string | undefined) ?? "";
  // A window at Daily grain must come from `range` — `/daily` serves ONE date.
  const path = singleDate ? "daily" : "range";
  const body = await apiClient.get<HrEnvelope<Raw>>(
    `/reports/${path}${queryFor(params, singleDate ? "daily" : "range")}`,
  );
  const rows: AttendanceDailyRow[] = [];
  for (const entry of body.data ?? []) {
    const records = Array.isArray(entry.records) ? (entry.records as Raw[]) : null;
    if (records) {
      // `range` shape — one employee, many dates.
      for (const rec of records) rows.push(toDailyRow(entry, rec));
    } else {
      // `daily` shape — the employee row IS the day.
      rows.push(toDailyRow(entry, entry));
    }
  }
  return {
    rows,
    totals: toTotals(body.totals, scopeNoteFor(body)),
    page: body.pagination?.page ?? 1,
    pageSize: body.pagination?.limit ?? rows.length,
    total: body.pagination?.total ?? rows.length,
    generatedAt: new Date().toISOString(),
    unreconciled: body.unreconciled ?? null,
    clampedTo: str(body.dateTo),
  };
}

function toDailyRow(employee: Raw, rec: Raw): AttendanceDailyRow {
  const holidayName = str(rec.holidayName);
  return {
    id: str(rec.id) ?? `${str(employee.userId) ?? ""}-${str(rec.attendanceDate) ?? ""}`,
    userId: str(employee.userId) ?? "",
    name: str(employee.name),
    designation: str(employee.designation),
    attendanceDate: str(rec.attendanceDate) ?? "",
    status: str(rec.status) ?? "Absent",
    // The day's resolved work location. A punch states rank-1 provenance; where
    // the row carries no project the cell degrades rather than inventing one.
    locationName:
      str(rec.projectName) ??
      str(employee.projectName) ??
      str((Array.isArray(rec.punches) ? (rec.punches as Raw[])[0] : undefined)?.projectName),
    checkIn: toHhMm(rec.checkInAt, rec.checkInTime),
    checkOut: toHhMm(rec.checkOutAt, rec.checkOutTime),
    punchCount: num(rec.punchCount),
    sourceLabel: sourceLabel(rec.punches),
    holidayName,
  };
}

/** RANGE — per-employee day counts over the window, with the server's own percentage. */
export async function runAttendanceRange(
  params: ReportParams,
): Promise<AttendanceLevelResult<AttendanceRangeRow>> {
  const body = await apiClient.get<HrEnvelope<Raw>>(`/reports/range${queryFor(params, "range")}`);
  const rows = (body.data ?? []).map(
    (r): AttendanceRangeRow => ({
      id: str(r.id) ?? str(r.userId) ?? "",
      userId: str(r.userId) ?? "",
      name: str(r.name),
      designation: str(r.designation),
      projectName: str(r.projectName),
      costCentreName: str(r.costCentreName),
      present: num(r.presentCount ?? r.present),
      paidLeave: num(r.paidLeaveCount ?? r.paidLeave),
      unpaidLeave: num(r.unpaidLeaveCount ?? r.unpaidLeave),
      absent: num(r.absentCount ?? r.absent),
      attendancePercentage: pct(r.attendancePercentage),
      employeeInactive: r.employeeInactive as boolean | undefined,
    }),
  );
  return {
    rows,
    totals: toTotals(body.totals, scopeNoteFor(body)),
    page: body.pagination?.page ?? 1,
    pageSize: body.pagination?.limit ?? rows.length,
    total: body.pagination?.total ?? rows.length,
    generatedAt: new Date().toISOString(),
    unreconciled: body.unreconciled ?? null,
    clampedTo: str(body.dateTo),
  };
}

/** "42 employees · 25 working days" — the muted line under the totals band. */
function scopeNoteFor(body: HrEnvelope<Raw>): string | undefined {
  const employees = num((body.totals as Raw | undefined)?.totalEmployees);
  const workingDays = num(body.totalWorkingDays ?? (body.totals as Raw | undefined)?.workingDays);
  const parts: string[] = [];
  if (employees) parts.push(`${employees} ${employees === 1 ? "employee" : "employees"}`);
  if (workingDays) parts.push(`${workingDays} working days`);
  return parts.length ? parts.join(" · ") : undefined;
}
