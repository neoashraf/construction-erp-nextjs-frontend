import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";

/**
 * HR Attendance API bindings (API contract 12 § "Attendance"; FR-HR-004…-012, -018).
 * Three modes (office / daily-labour / subcontractor) on one endpoint tree; only
 * daily-labour has a Confirm/Reverse lifecycle — that is the accrual post. Subcontractor
 * is GL-free tracking (SRS §5.2). Reads are paginated over `AttendanceRecord`; writes are
 * bulk `rows[]` per mode. `companyId` is implicit from the JWT. Site Engineer/PM are
 * project-scoped server-side; the UI hides Confirm/Reverse based on `access.ts`.
 */

const BASE = "/attendance";

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export type AttendanceMode = "OFFICE" | "DAILY_LABOUR" | "SUBCONTRACTOR";
export type DayStatus = "PRESENT" | "PAID_LEAVE" | "UNPAID_LEAVE" | "ABSENT";
export type AttendanceSource = "MANUAL" | "BIOMETRIC_IMPORT";

/** The unified `AttendanceRecord` shape (see contract 12). Fields vary by mode. */
export interface AttendanceRecord {
  id: string;
  mode: AttendanceMode;
  attendanceDate: string; // YYYY-MM-DD
  projectId: string;
  costCentreId: string | null;
  purposeId: string | null;
  // office
  employeeId: string | null;
  checkIn: string | null; // HH:mm
  checkOut: string | null; // HH:mm
  dayStatus: DayStatus | null;
  overtimeHours: string | null; // Decimal(18,3)
  // subcontractor
  partyId: string | null;
  // daily-labour + subcontractor
  headCount: number | null;
  labourCategory: string | null;
  dailyRate: string | null; // Decimal(18,4)
  source: AttendanceSource;
  isConfirmed: boolean;
  accrualEntryId: string | null;
  entryNo?: string | null;
  accruedAmount?: string | null;
  postedAt?: string | null;
  postedBy?: string | null;
  reversalEntryNo?: string | null;
  reversalEntryId?: string | null;
  version: number;
}

export interface AttendanceListFilter {
  mode: AttendanceMode;
  attendanceDate: string; // YYYY-MM-DD
  projectId?: string;
  costCentreId?: string;
  employeeId?: string;
  partyId?: string;
  isConfirmed?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AttendancePage {
  data: AttendanceRecord[];
  page: number;
  pageSize: number;
  total: number;
}

function buildListQuery(f: AttendanceListFilter): string {
  const p = new URLSearchParams();
  p.set("mode", f.mode);
  p.set("attendanceDate", f.attendanceDate);
  if (f.projectId) p.set("projectId", f.projectId);
  if (f.costCentreId) p.set("costCentreId", f.costCentreId);
  if (f.employeeId) p.set("employeeId", f.employeeId);
  if (f.partyId) p.set("partyId", f.partyId);
  if (typeof f.isConfirmed === "boolean") p.set("isConfirmed", String(f.isConfirmed));
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? 200));
  return p.toString();
}

export async function listAttendance(f: AttendanceListFilter): Promise<AttendancePage> {
  const res = await apiClient.get<{
    data: AttendanceRecord[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildListQuery(f)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? f.page ?? 1,
    pageSize: meta.pageSize ?? f.pageSize ?? 200,
    total: meta.total ?? res.data.length,
  };
}

// ── Office ──
export interface OfficeAttendanceRow {
  employeeId: string;
  attendanceDate: string;
  projectId: string;
  checkIn?: string | null;
  checkOut?: string | null;
  dayStatus: DayStatus;
  overtimeHours?: string | null;
}
export interface BulkSaveResult {
  ids: string[];
}
export async function saveOfficeAttendance(rows: OfficeAttendanceRow[]): Promise<BulkSaveResult> {
  const res = await apiClient.post<{ data: BulkSaveResult }>(
    `${BASE}/office`,
    { rows },
    csrf(),
  );
  return res.data;
}

/**
 * A biometric device-feed row (backend `BiometricAttendanceRow`). Note this is NOT the same
 * as `OfficeAttendanceRow`: the feed keys the employee by their human `employeeCode` (e.g. the
 * device/machine id printed on the sheet, not a UUID) and carries NO per-row projectId — the
 * project is supplied once, at the top level of the import, from the roster's selected project.
 */
export interface BiometricFeedRow {
  employeeCode: string;
  attendanceDate: string; // YYYY-MM-DD
  checkIn?: string | null; // HH:mm
  checkOut?: string | null; // HH:mm
  dayStatus?: DayStatus | null;
  overtimeHours?: string | null;
}
/** A row the import could not place. `reason` is a server code (see `mapAttendanceError`). */
export interface BiometricConflict {
  employeeId: string; // resolved id, or the raw employeeCode when the code was unknown
  attendanceDate: string;
  reason: string;
}
export interface BiometricImportResult {
  imported: number; // rows read from the feed
  reconciled: number; // rows actually inserted (non-conflicting)
  conflicts: BiometricConflict[];
}
/**
 * Import an office biometric feed for a single project. The backend resolves each
 * `employeeCode`, applies `projectId` to every row, defaults status to PRESENT, and inserts
 * the non-conflicting rows directly (append-only; never doubles a day). `projectId` is
 * required and must be a real project UUID.
 */
export async function importOfficeBiometric(
  projectId: string,
  feed: BiometricFeedRow[],
): Promise<BiometricImportResult> {
  const res = await apiClient.post<{ data: BiometricImportResult }>(
    `${BASE}/office/import`,
    { projectId, deviceFeed: feed },
    csrf(),
  );
  return res.data;
}

// ── Subcontractor ──
export interface SubcontractorRow {
  partyId: string;
  attendanceDate: string;
  projectId: string;
  costCentreId: string;
  purposeId?: string | null;
  headCount: number;
}
export async function saveSubcontractorAttendance(rows: SubcontractorRow[]): Promise<BulkSaveResult> {
  const res = await apiClient.post<{ data: BulkSaveResult }>(
    `${BASE}/subcontractor`,
    { rows },
    csrf(),
  );
  return res.data;
}

// ── Daily labour ──
export interface DailyLabourRowInput {
  attendanceDate: string;
  projectId: string;
  costCentreId: string;
  purposeId?: string | null;
  labourCategory?: string | null;
  headCount: number;
  dailyRate: string; // Decimal(18,4)
}
export async function saveDailyLabourAttendance(rows: DailyLabourRowInput[]): Promise<BulkSaveResult> {
  const res = await apiClient.post<{ data: BulkSaveResult }>(
    `${BASE}/daily-labour`,
    { rows },
    csrf(),
  );
  return res.data;
}

export interface DailyLabourUpdateInput {
  headCount?: number;
  dailyRate?: string;
  labourCategory?: string | null;
  purposeId?: string | null;
  version: number;
}
export async function updateDailyLabour(id: string, input: DailyLabourUpdateInput): Promise<AttendanceRecord> {
  const res = await apiClient.patch<{ data: AttendanceRecord }>(
    `${BASE}/daily-labour/${encodeURIComponent(id)}`,
    input,
    csrf(),
  );
  return res.data;
}

export interface DailyLabourConfirmInput {
  purposeId: string;
  version: number;
}
export interface DailyLabourConfirmResult {
  attendanceId: string;
  accrualEntryId: string;
  entryNo: string;
  accruedAmount: string;
  isConfirmed: true;
  postedAt: string;
  postedBy: string;
  version: number;
}
export async function confirmDailyLabour(
  id: string,
  input: DailyLabourConfirmInput,
): Promise<DailyLabourConfirmResult> {
  const res = await apiClient.post<{ data: DailyLabourConfirmResult }>(
    `${BASE}/daily-labour/${encodeURIComponent(id)}/confirm`,
    input,
    csrf(),
  );
  return res.data;
}

export interface DailyLabourReverseInput {
  reason: string;
}
export interface DailyLabourReverseResult {
  reversalEntryId: string;
  reversalEntryNo: string;
  originalEntryId: string;
}
export async function reverseDailyLabour(
  id: string,
  input: DailyLabourReverseInput,
): Promise<DailyLabourReverseResult> {
  const res = await apiClient.post<{ data: DailyLabourReverseResult }>(
    `${BASE}/daily-labour/${encodeURIComponent(id)}/reverse`,
    input,
    csrf(),
  );
  return res.data;
}
