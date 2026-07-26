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
  status?: "Present" | "Absent" | "Late" | "Holiday" | (string & {});
  punchCount?: number;
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

export async function getSummaryReport(q: AttendanceLogQuery): Promise<SummaryReport> {
  const p = filterParams(q);
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 25));
  const raw = await apiClient.get<unknown>(`/reports/summary?${p.toString()}`);

  const body = (raw ?? {}) as Partial<SummaryReport>;
  const data = Array.isArray(body.data) ? body.data : [];
  const page = body.pagination;
  return {
    dateFrom: body.dateFrom ?? q.dateFrom ?? "",
    dateTo: body.dateTo ?? q.dateTo ?? "",
    label: body.label ?? "",
    totalDays: body.totalDays ?? 0,
    totalWorkingDays: body.totalWorkingDays ?? 0,
    lateAfter: body.lateAfter ?? "",
    totals: { ...EMPTY_COUNTS, totalEmployees: 0, ...(body.totals ?? {}) },
    data,
    pagination: {
      page: page?.page ?? q.page ?? 1,
      limit: page?.limit ?? q.limit ?? 25,
      total: page?.total ?? data.length,
      totalPages: page?.totalPages ?? 1,
    },
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

export async function getDeviceStatus(): Promise<DeviceStatus> {
  const raw = await apiClient.get<unknown>("/device/status");
  const body = (raw ?? {}) as Partial<DeviceStatus>;
  // Only an explicit `online: true` counts as up — an unrecognised payload reads as
  // offline, which is the safe answer for a heartbeat.
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

// ── Sync ──

export interface SyncSummary {
  users: { fetched: number; created: number; updated: number; unchanged: number; skipped: number };
  attendance: { fetched: number; inserted: number; duplicates: number; skipped: number };
  unnamedUsers: number;
  durationMs: number;
}

export interface SyncStatus {
  syncing: boolean;
  configured: boolean;
  deviceIp: string | null;
  devicePort: number | null;
  lastSyncAt: string | null;
  lastSync: SyncSummary | null;
}

/** Zeroed sync counters, so a malformed summary reports "Already up to date" not NaN. */
function toSyncSummary(raw: unknown): SyncSummary {
  const body = (raw ?? {}) as Partial<SyncSummary>;
  const users: Partial<SyncSummary["users"]> = body.users ?? {};
  const attendance: Partial<SyncSummary["attendance"]> = body.attendance ?? {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    users: {
      fetched: n(users.fetched),
      created: n(users.created),
      updated: n(users.updated),
      unchanged: n(users.unchanged),
      skipped: n(users.skipped),
    },
    attendance: {
      fetched: n(attendance.fetched),
      inserted: n(attendance.inserted),
      duplicates: n(attendance.duplicates),
      skipped: n(attendance.skipped),
    },
    unnamedUsers: n(body.unnamedUsers),
    durationMs: n(body.durationMs),
  };
}

/** Pull users + punches from the device. Long-running; the UI disables the button meanwhile. */
export async function runSync(): Promise<SyncSummary> {
  const res = await apiClient.post<{ data?: unknown }>("/sync", {}, csrf());
  return toSyncSummary(res?.data);
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const raw = await apiClient.get<unknown>("/sync/status");
  const body = (raw ?? {}) as Partial<SyncStatus>;
  return {
    syncing: body.syncing === true,
    // Assume configured unless the server explicitly says otherwise — this only softens
    // a tooltip, and defaulting to "not configured" would wrongly imply a broken setup.
    configured: body.configured !== false,
    deviceIp: body.deviceIp ?? null,
    devicePort: body.devicePort ?? null,
    lastSyncAt: body.lastSyncAt ?? null,
    lastSync: body.lastSync ? toSyncSummary(body.lastSync) : null,
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
