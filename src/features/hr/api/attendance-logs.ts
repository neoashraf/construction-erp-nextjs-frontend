import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";

/**
 * Biometric device attendance-log bindings (`/logs`, `/reports/*`, `/device`, `/sync`).
 *
 * These sit alongside `./attendance.ts` (the ledger-posting three-mode capture screen) and
 * are deliberately separate: this tree is the **device feed** — read-only reporting over
 * punches pulled from the fingerprint/face terminal, with no GL involvement. Nothing here
 * posts to the ledger.
 *
 * The browser talks to the BFF (`/api/...`), which forwards to NestJS through the
 * cookie→bearer bridge — so no `Authorization` header is built here and no token is ever
 * read by client JS (ADR-0003 F5). The catch-all proxy at `app/api/[...path]` routes these
 * paths automatically once the backend implements them.
 *
 * Timestamps from the device arrive as `"YYYY-MM-DD HH:mm:ss"` (local wall-clock, NOT ISO).
 * Never hand those to `new Date()` directly — use `parseDeviceTimestamp` in `../lib/attendance-time`.
 */

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/**
 * The four canonical ingestion paths a punch can arrive by (API contract 12 § `sourceType`).
 * `DEVICE_PUSH` is a NORMALISED value — ingestion maps the device's wire formats (`ATTLOG` /
 * `TAB` / `CSV`) onto it — so the UI never sees a serialisation detail. Anything unlisted
 * degrades to "Machine" rather than a blank cell (see `sourceBadgeLabel`).
 */
export type PunchSourceType = "DEVICE_PUSH" | "DEVICE_SYNC" | "EXCEL_IMPORT" | "MANUAL";

/**
 * One punch that folded into a day — the read-only provenance beneath the day row.
 *
 * `projectId`/`projectName` are the location stated on the PUNCH ITSELF (rank 1 of the
 * resolution order), which is not always the day's resolved project: a `MANUAL` punch always
 * carries one (the Location picker is required), an `EXCEL_IMPORT` punch carries one when the
 * sheet row supplied a resolvable `location`, and a device punch always carries `null` because
 * a machine states no location. A `null` therefore means "fall back to the day's resolved
 * location", which the drawer renders — it never means the punch is broken.
 */
export interface AttendancePunch {
  /** `HH:mm:ss` — the punch time. */
  time: string;
  sourceType: PunchSourceType | (string & {});
  projectId: string | null;
  projectName: string | null;
}

/** One day's punch detail for an employee, as returned inside a log row. */
export interface AttendanceDayRecord {
  id: string;
  /** `YYYY-MM-DD`. */
  attendanceDate?: string;
  holidayName?: string;
  holidayType?: string;
  /** `"YYYY-MM-DD HH:mm:ss"` — local wall-clock, not ISO. */
  deviceTimestamp: string | null;
  occurredAt: string | null;
  receivedAt: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  /**
   * Six values since 29/07/2026 (API contract 12 § Attendance reports): `Present` · `Late` ·
   * `Absent` · `Holiday` · `Paid leave` · `Unpaid leave`. The last three are DECLARED from
   * `attendance_record.day_status`; the first two are DERIVED from the check-in against the
   * configured late threshold.
   */
  status?:
    | "Present"
    | "Absent"
    | "Late"
    | "Holiday"
    | "Paid leave"
    | "Unpaid leave"
    | (string & {});
  punchCount?: number;
  /**
   * Every punch that folded into this day, in time order — provenance, not a conflict list.
   * Empty (or absent) on a day that carries a status and no times, which is a legitimate
   * FR-HR-004 second-branch day, NOT a load failure.
   */
  punches?: AttendancePunch[];
}

/** A row from `GET /logs` — either a single-day punch or a range aggregate. */
export interface LogEntry {
  id: string;
  userId: string;
  name: string | null;
  designation?: string | null;
  deviceTimestamp: string | null;
  occurredAt: string | null;
  receivedAt: string | null;
  status: string | null;
  sourceType: string | null;
  /** Working days in range, holidays excluded. */
  workingDays?: number;
  onTimeCount?: number;
  /** NB: late days are counted INSIDE `presentCount` — don't add the two. */
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  holidayCount?: number;
  attendancePercentage?: number;
  attendanceRecords?: AttendanceDayRecord[];
}

/** The `/logs` + `/reports/summary` pagination envelope (distinct from the ERP `Paginated`). */
export interface LogsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LogsResponse {
  data: LogEntry[];
  pagination: LogsPagination;
}

/** Shared count block used by both a summary row and the report totals. */
export interface ReportCounts {
  workingDays: number;
  onTimeCount: number;
  lateCount: number;
  presentCount: number;
  absentCount: number;
  holidayCount: number;
  attendancePercentage: number;
}

export interface SummaryReportRow extends ReportCounts {
  id: string;
  userId: string;
  name: string | null;
  designation: string | null;
}

/**
 * The skipped-day guard carried by all three reports (FR-HR-008a), always present.
 *
 * Counts employee-days in the window that have punches but NO reconciled day row. Those days
 * still render `Absent` in `data` — this is what tells the reader not to trust that. A client
 * must surface a non-empty `unreconciled` as prominently as it does `skippedReasons`, because
 * the alternative is a report that reads complete while people who worked show as absent, and
 * are then paid as absent under FR-HR-013a.
 */
export interface UnreconciledGuard {
  days: number;
  reasons: Record<string, number>;
  sample: Array<{ userId: string; attendanceDate: string; reason: string }>;
}

/** One employee's row in `GET /reports/daily` — a single date, no nested records. */
export interface DailyReportRow {
  id: string;
  userId: string;
  name: string | null;
  designation: string | null;
  attendanceDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInTime: string;
  checkOutTime: string;
  punchCount: number;
}

export interface DailyReport {
  date: string;
  isHoliday: boolean;
  holiday: { name: string; type: string } | null;
  lateAfter: string;
  totals: ReportCounts & { totalEmployees: number };
  data: DailyReportRow[];
  pagination: LogsPagination;
  unreconciled: UnreconciledGuard;
}

/** One employee's row in `GET /reports/range` — carries its own totals INLINE plus `records[]`. */
export interface RangeReportRow extends ReportCounts {
  id: string;
  userId: string;
  name: string | null;
  designation: string | null;
  /** Every date in the window — absences and holidays included (the gap-free calendar). */
  records: AttendanceDayRecord[];
}

export interface RangeReport {
  dateFrom: string;
  dateTo: string;
  label: string;
  totalDays: number;
  totalWorkingDays: number;
  lateAfter: string;
  totals: ReportCounts & { totalEmployees: number };
  data: RangeReportRow[];
  pagination: LogsPagination;
  unreconciled: UnreconciledGuard;
}

export interface SummaryReport {
  dateFrom: string;
  dateTo: string;
  label: string;
  totalDays: number;
  totalWorkingDays: number;
  lateAfter: string;
  totals: ReportCounts & { totalEmployees: number };
  data: SummaryReportRow[];
  pagination: LogsPagination;
  unreconciled: UnreconciledGuard;
}

/**
 * Filters shared by `/logs`, `/reports/summary` and the export endpoints.
 * `userId` and `name` are mutually exclusive in practice — the search box picks one
 * based on whether the term is all-digits (see `../lib/attendance-filters`).
 */
export interface AttendanceLogFilters {
  userId?: string;
  name?: string;
  /** Single-day mode. */
  date?: string;
  /** Range/month mode. */
  dateFrom?: string;
  dateTo?: string;
}

export interface AttendanceLogQuery extends AttendanceLogFilters {
  page?: number;
  limit?: number;
}

/** Serialise filters, omitting empty params entirely (the server treats "" as a real filter). */
function filterParams(f: AttendanceLogFilters): URLSearchParams {
  const p = new URLSearchParams();
  const userId = f.userId?.trim();
  const name = f.name?.trim();
  if (userId) p.set("userId", userId);
  if (name) p.set("name", name);
  if (f.date) p.set("date", f.date);
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo) p.set("dateTo", f.dateTo);
  return p;
}

/**
 * Coerce whatever came back into the paginated envelope the screen expects.
 *
 * The response is validated rather than trusted, because a non-array `data` reaches the
 * table as a `.map is not a function` crash rather than a handled error state. That is not
 * hypothetical: the dev mock backend answers unknown routes with `{ data: { ok, path } }`,
 * so every one of these endpoints returns an object here until the real backend ships.
 * A malformed payload degrades to an empty page instead of taking the screen down.
 */
function toLogsResponse(raw: unknown, q: AttendanceLogQuery): LogsResponse {
  const body = (raw ?? {}) as Partial<LogsResponse>;
  const data = Array.isArray(body.data) ? body.data : [];
  const page = body.pagination;
  return {
    data,
    pagination: {
      page: page?.page ?? q.page ?? 1,
      limit: page?.limit ?? q.limit ?? 20,
      total: page?.total ?? data.length,
      totalPages: page?.totalPages ?? 1,
    },
  };
}

/**
 * `GET /logs` — the punch surface, and from FE-64 the source of the day-detail punch
 * breakdown and NOTHING ELSE.
 *
 * It reads `checkin_log`, so a day carrying a status and no times has no row here at all —
 * by design, not a defect. The office-staff review reads `GET /reports/{daily,range}` instead,
 * which read `attendance_record` and therefore CAN represent a timeless leave day. Pages on
 * `limit`, not `pageSize` (envelope exception, contract §preamble).
 */
export async function listAttendanceLogs(q: AttendanceLogQuery): Promise<LogsResponse> {
  const p = filterParams(q);
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 20));
  const raw = await apiClient.get<unknown>(`/logs?${p.toString()}`);
  return toLogsResponse(raw, q);
}

/** Zeroed counts used when the report payload is absent or malformed. */
const EMPTY_COUNTS: ReportCounts = {
  workingDays: 0,
  onTimeCount: 0,
  lateCount: 0,
  presentCount: 0,
  absentCount: 0,
  holidayCount: 0,
  attendancePercentage: 0,
};

/**
 * Coerce the guard. Always returns an object, so a client never has to distinguish "no
 * problems" from "this version doesn't tell me" — the server contracts it the same way.
 */
function toUnreconciled(raw: unknown): UnreconciledGuard {
  const body = (raw ?? {}) as Partial<UnreconciledGuard>;
  return {
    days: count(body.days),
    reasons: body.reasons && typeof body.reasons === "object" ? body.reasons : {},
    sample: Array.isArray(body.sample) ? body.sample : [],
  };
}

function toPagination(raw: LogsPagination | undefined, q: AttendanceLogQuery, fallbackTotal: number, defaultLimit: number): LogsPagination {
  return {
    page: raw?.page ?? q.page ?? 1,
    limit: raw?.limit ?? q.limit ?? defaultLimit,
    total: raw?.total ?? fallbackTotal,
    totalPages: raw?.totalPages ?? 1,
  };
}

export async function getSummaryReport(q: AttendanceLogQuery): Promise<SummaryReport> {
  const p = filterParams(q);
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 25));
  const raw = await apiClient.get<unknown>(`/reports/summary?${p.toString()}`);

  const body = (raw ?? {}) as Partial<SummaryReport>;
  const data = Array.isArray(body.data) ? body.data : [];
  return {
    dateFrom: body.dateFrom ?? q.dateFrom ?? "",
    dateTo: body.dateTo ?? q.dateTo ?? "",
    label: body.label ?? "",
    totalDays: body.totalDays ?? 0,
    totalWorkingDays: body.totalWorkingDays ?? 0,
    lateAfter: body.lateAfter ?? "",
    totals: { ...EMPTY_COUNTS, totalEmployees: 0, ...(body.totals ?? {}) },
    data,
    pagination: toPagination(body.pagination, q, data.length, 25),
    unreconciled: toUnreconciled(body.unreconciled),
  };
}

/**
 * `GET /reports/daily` — one row per employee for a single date.
 *
 * Reads `attendance_record`, NOT the punch log, so a timeless `PAID_LEAVE`/`ABSENT` day is
 * representable rather than inferred absent from missing punches (contract resolved 29/07/2026).
 * That is the whole reason the office-staff review moved off `GET /logs`.
 *
 * Pages on `limit`, not `pageSize` — verified against the contract rather than inherited from
 * `/logs`. Both routes carry `@NoEnvelope()`, so the body IS the response.
 */
export async function getDailyReport(q: AttendanceLogQuery): Promise<DailyReport> {
  const p = filterParams(q);
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 20));
  const raw = await apiClient.get<unknown>(`/reports/daily?${p.toString()}`);

  const body = (raw ?? {}) as Partial<DailyReport>;
  const data = Array.isArray(body.data) ? body.data : [];
  return {
    date: body.date ?? q.date ?? "",
    isHoliday: body.isHoliday === true,
    holiday: body.holiday ?? null,
    lateAfter: body.lateAfter ?? "",
    totals: { ...EMPTY_COUNTS, totalEmployees: 0, ...(body.totals ?? {}) },
    data,
    pagination: toPagination(body.pagination, q, data.length, 20),
    unreconciled: toUnreconciled(body.unreconciled),
  };
}

/**
 * `GET /reports/range` — every date in the window per employee, absences included.
 *
 * The gap-free calendar: unlike `GET /logs`, which omits punch-less days entirely, this emits
 * a record for every date, so the client renders a month with no gap-filling of its own.
 */
export async function getRangeReport(q: AttendanceLogQuery): Promise<RangeReport> {
  const p = filterParams(q);
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 25));
  const raw = await apiClient.get<unknown>(`/reports/range?${p.toString()}`);

  const body = (raw ?? {}) as Partial<RangeReport>;
  const data = Array.isArray(body.data) ? body.data : [];
  return {
    dateFrom: body.dateFrom ?? q.dateFrom ?? "",
    dateTo: body.dateTo ?? q.dateTo ?? "",
    label: body.label ?? "",
    totalDays: count(body.totalDays),
    totalWorkingDays: count(body.totalWorkingDays),
    lateAfter: body.lateAfter ?? "",
    totals: { ...EMPTY_COUNTS, totalEmployees: 0, ...(body.totals ?? {}) },
    data,
    pagination: toPagination(body.pagination, q, data.length, 25),
    unreconciled: toUnreconciled(body.unreconciled),
  };
}

// ── Device status ──

export interface DeviceStatus {
  status: "online" | "offline";
  online: boolean;
  lastSeenAt: string | null;
  lastSeenAgeMs: number | null;
  onlineWindowMs: number | null;
  lastMethod?: string | null;
  lastPath?: string | null;
  lastRemoteAddress?: string | null;
}

/**
 * Coerce a device-status payload. Only an explicit `online: true` (or `status: "online"`)
 * counts as up — an unrecognised payload reads as offline, which is the safe answer for a
 * heartbeat. Shared with `getSyncStatus`, which embeds the same object.
 */
function toDeviceStatus(raw: unknown): DeviceStatus {
  const body = (raw ?? {}) as Partial<DeviceStatus>;
  const online = body.online === true || body.status === "online";
  return {
    status: online ? "online" : "offline",
    online,
    lastSeenAt: body.lastSeenAt ?? null,
    lastSeenAgeMs: body.lastSeenAgeMs ?? null,
    onlineWindowMs: body.onlineWindowMs ?? null,
    lastMethod: body.lastMethod ?? null,
    lastPath: body.lastPath ?? null,
    lastRemoteAddress: body.lastRemoteAddress ?? null,
  };
}

export async function getDeviceStatus(): Promise<DeviceStatus> {
  return toDeviceStatus(await apiClient.get<unknown>("/device/status"));
}

// ── Sync ──

/**
 * The result of a manual sync.
 *
 * The backend answers one of two shapes depending on how it ran:
 *  - `mode: "pull"` — it opened a socket to the device and pulled the roster + punch
 *    history (the normal path when `DEVICE_IP` is configured and no window was given).
 *  - `mode: "reconcile"` — it re-folded punches ALREADY stored into attendance records.
 *    Used when an explicit date window is requested, or when no device is configured.
 *
 * Both are surfaced through one type so the button does not have to branch. Counters absent
 * from a given mode are simply zero.
 */
export interface SyncSummary {
  mode: "pull" | "reconcile";
  /** Pull only — roster outcome. */
  users: { fetched: number; created: number; updated: number; unchanged: number; skipped: number };
  /** Pull only — punch storage outcome. `duplicates` proves idempotency on a repeat run. */
  attendance: { fetched: number; inserted: number; duplicates: number; skipped: number };
  /** Employees still carrying a placeholder name; they need a manual fix to read well. */
  unnamedUsers: number;
  durationMs: number;
  /** Employee-days folded into attendance records — the number that decides visibility. */
  reconciled: number;
  /**
   * Why days could not be folded, counted by reason (e.g. `NO_FINANCIAL_YEAR`, `NO_PROJECT`).
   *
   * Load-bearing for the operator: a sync can store hundreds of punches and still surface
   * none of them in the reports. Without this the button would report success while the
   * table stayed empty.
   */
  skippedReasons: Record<string, number>;
  /** Reconcile mode only — the window that was re-folded. */
  dateFrom?: string;
  dateTo?: string;
  /** Reconcile mode only — distinct punch-days found in the window. */
  days?: number;
}

/**
 * Sync context. `configured`/`deviceIp` describe the PULL path; `device`/`lastRecordAt`
 * describe what has actually arrived, by either path.
 */
export interface SyncStatus {
  syncing: boolean;
  /** True when `DEVICE_IP` is set, i.e. a real pull is possible. */
  configured: boolean;
  deviceIp: string | null;
  devicePort: number | null;
  lastSyncAt: string | null;
  lastSync: SyncSummary | null;
  device: DeviceStatus;
  /** When the newest punch was received by the server (ISO-8601), or null if none. */
  lastRecordAt: string | null;
  /** The device's own wall-clock stamp on that punch (`YYYY-MM-DD HH:mm:ss`). */
  lastDeviceTimestamp: string | null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Coerce the sync result; counters default to 0 so the summary line never shows NaN. */
function toSyncSummary(raw: unknown): SyncSummary {
  const body = (raw ?? {}) as Partial<SyncSummary> & { skipped?: unknown };
  const users: Partial<SyncSummary["users"]> = body.users ?? {};
  const attendance: Partial<SyncSummary["attendance"]> = body.attendance ?? {};

  // Reconcile mode reports `skipped` as an array of rows rather than a reason map; fold it
  // into the same shape so the caller never branches on mode.
  const skippedReasons: Record<string, number> = { ...(body.skippedReasons ?? {}) };
  if (Array.isArray(body.skipped)) {
    for (const row of body.skipped as Array<{ reason?: string }>) {
      const reason = row?.reason ?? "UNKNOWN";
      skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
    }
  }

  return {
    mode: body.mode === "pull" ? "pull" : "reconcile",
    users: {
      fetched: count(users.fetched),
      created: count(users.created),
      updated: count(users.updated),
      unchanged: count(users.unchanged),
      skipped: count(users.skipped),
    },
    attendance: {
      fetched: count(attendance.fetched),
      inserted: count(attendance.inserted),
      duplicates: count(attendance.duplicates),
      skipped: count(attendance.skipped),
    },
    unnamedUsers: count(body.unnamedUsers),
    durationMs: count(body.durationMs),
    reconciled: count(body.reconciled),
    skippedReasons,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    days: count(body.days),
  };
}

/**
 * Re-reconcile ingested punches into attendance records.
 *
 * The response is FLAT — these routes carry `@NoEnvelope()` on the backend, so there is no
 * `{ data }` wrapper to unwrap. Requires `hr.attendance:UPDATE` (not READ), since it writes.
 */
export async function runSync(): Promise<SyncSummary> {
  const raw = await apiClient.post<unknown>("/sync", {}, csrf());
  return toSyncSummary(raw);
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const raw = await apiClient.get<unknown>("/sync/status");
  const body = (raw ?? {}) as Partial<SyncStatus>;
  return {
    syncing: body.syncing === true,
    // Treat an unrecognised payload as NOT configured: the tooltip then explains that a
    // pull is unavailable, which is truthful, rather than promising one that will fail.
    configured: body.configured === true,
    deviceIp: body.deviceIp ?? null,
    devicePort: body.devicePort ?? null,
    lastSyncAt: body.lastSyncAt ?? null,
    lastSync: body.lastSync ? toSyncSummary(body.lastSync) : null,
    device: toDeviceStatus(body.device),
    lastRecordAt: body.lastRecordAt ?? null,
    lastDeviceTimestamp: body.lastDeviceTimestamp ?? null,
  };
}

// ── Import ──

/** One spreadsheet row, still as raw text — the server owns validation and the messages. */
export interface ImportRow {
  userId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm` or `HH:mm:ss`. */
  checkIn: string;
  checkOut: string;
  /**
   * The work location for THIS row (optional) — a human-readable string, not a picker id,
   * because a person typed it into a cell. The server matches it against the project master
   * by CODE first, then name, case-insensitively and trimmed, and writes the resolved project
   * onto every punch the row produces — rank 1 of the resolution order, outranking the device
   * default (rank 2) and the employee default (rank 3).
   *
   * Left blank the row falls back to the device default, then the employee's, then a
   * `NO_PROJECT` skip — so a sheet with no Location column keeps working untouched. Without
   * this column the WHOLE upload resolves to one project (whichever device default it
   * inherits), so a branch office's entry log is costed entirely to head-office overhead and
   * that labour cost never reaches the site.
   */
  location?: string;
}

export interface ImportRowError {
  /** 1-based row number as it appears in Excel (the header is row 1). */
  row: number;
  message: string;
}

/**
 * The outcome of an import.
 *
 * `duplicates` is the load-bearing field for the user's real question — "what happens when
 * this syncs with the device data I already have?". Punches are keyed on
 * (employee, timestamp), so anything the device already delivered counts as a duplicate and
 * is skipped rather than doubled. A re-import therefore reports `inserted: 0` and every
 * punch as a duplicate, which is exactly the reassurance the operator needs.
 */
export interface ImportResult {
  acceptedRows: number;
  blankRows: number;
  punches: number;
  inserted: number;
  duplicates: number;
  reconciled: number;
  /** Why employee-days could not reach the reports (`NO_FINANCIAL_YEAR`, `NO_PROJECT`, …). */
  skippedReasons: Record<string, number>;
  errors: ImportRowError[];
}

/** Keep only well-formed row errors — a malformed entry would render as "Row undefined". */
function toRowErrors(raw: unknown): ImportRowError[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const e = entry as Partial<ImportRowError> | null;
    if (!e || typeof e.message !== "string") return [];
    return [{ row: typeof e.row === "number" ? e.row : 0, message: e.message }];
  });
}

/**
 * Send parsed spreadsheet rows for import.
 *
 * The workbook is parsed in the BROWSER and posted as JSON — the server never receives a
 * binary file. `@NoEnvelope()` on the backend means the response is flat, with no `{ data }`
 * wrapper to unwrap. Requires `hr.attendance:UPDATE`, since it writes attendance.
 */
export async function importAttendanceRows(rows: ImportRow[]): Promise<ImportResult> {
  const raw = await apiClient.post<unknown>("/attendance/import", { rows }, csrf());
  const body = (raw ?? {}) as Partial<ImportResult>;
  return {
    acceptedRows: count(body.acceptedRows),
    blankRows: count(body.blankRows),
    punches: count(body.punches),
    inserted: count(body.inserted),
    duplicates: count(body.duplicates),
    reconciled: count(body.reconciled),
    skippedReasons: body.skippedReasons ?? {},
    errors: toRowErrors(body.errors),
  };
}

// ── Export ──

export type ExportType = "summary" | "range" | "daily";

/**
 * Fetch a report export as CSV text.
 *
 * The API answers with a UTF-8 BOM so Excel sniffs the encoding correctly. That BOM is
 * stripped here — left in place it becomes part of the first header cell once SheetJS
 * parses the text, corrupting the first column name. Conversion to a real `.xlsx`
 * workbook happens in `../lib/attendance-export` (browser-only, dynamic `xlsx` import).
 */
export async function fetchExportCsv(type: ExportType, f: AttendanceLogFilters): Promise<string> {
  const p = filterParams(f);
  const qs = p.toString();
  const path = `/reports/${type}/export${qs ? `?${qs}` : ""}`;
  const raw = await apiClient.get<unknown>(path, { headers: { accept: "text/csv" } });

  // A JSON body here means the endpoint answered with something other than CSV (an error
  // envelope, or the dev mock's catch-all). Stringifying it would hand SheetJS
  // "[object Object]" and produce a silently corrupt workbook, so fail loudly instead.
  if (typeof raw !== "string") {
    throw new Error("The export endpoint did not return CSV data.");
  }
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}
