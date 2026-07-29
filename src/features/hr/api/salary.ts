import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";

/**
 * HR Salary API bindings (API contract 12 § "Salary"; FR-HR-013..-018). Generate a DRAFT
 * from attendance + wage type + overtime (server-computed — no client-side gross calc);
 * edit per-line or in bulk (DRAFT only); Post via `PostingService` (non-optimistic,
 * balanced-preview gated); Reverse a POSTED run (reason-required). `companyId` is
 * implicit from the JWT. `api/salary.ts` also exposes `getSheetPayslips` — reused by
 * FE-38 `fe-payslip` so the payslip binding isn't duplicated.
 */

const BASE = "/salary/sheets";

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export type SalarySheetStatus = "DRAFT" | "POSTED" | "REVERSED";

/** The `SalarySheet` summary (list rows + editor header). */
export interface SalarySheetSummary {
  id: string;
  financialYearId: string;
  periodLabel: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  status: SalarySheetStatus;
  salaryEntryId: string | null;
  entryNo: string | null;
  reversalEntryId: string | null;
  reversalEntryNo: string | null;
  totalGross: string; // Decimal(18,4)
  totalDeductions: string;
  totalNet: string;
  postedAt: string | null;
  postedBy: string | null;
  version: number;
}

/** A single line on a sheet (per-employee). `pfApplicable` gates the PF field. */
export interface SalarySheetLine {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  pfApplicable: boolean;
  /** `MONTHLY` | `DAILY` — drives the FR-HR-013a day columns' `—` rendering for daily wages. */
  wageType?: "MONTHLY" | "DAILY" | null;
  projectId: string | null;
  costCentreId: string | null; // always the Labour cost centre
  purposeId: string | null;
  // ── FR-HR-013a day/penalty figures — stored on the line at generate, served verbatim,
  //    never recomputed client-side. All read-only.
  standardDays: string; // Decimal(18,4) — the paid baseline (calendar days, clipped)
  unpaidDays: string; // Decimal(18,4) — deducted working days, incl. days with no record
  paidDays: string; // standard − unpaid (MONTHLY) · attended days (DAILY)
  lateCount: number;
  latePenaltyDays: string; // Decimal(18,4) — floor(lateCount ÷ latesPerDeductedDay)
  latePenaltyAmount: string; // Decimal(18,4) — what those days cost; already inside gross
  grossAmount: string; // Decimal(18,4) — read-only, already NET of the late penalty
  allowances: string; // editable in DRAFT
  tdsAmount: string;
  tdsRate: string | null; // percent (0..100)
  pfAmount: string;
  advanceRecovery: string;
  otherDeductions: string;
  netAmount: string; // read-only, server-computed
  version: number;
}

/**
 * The FR-HR-013a pre-post warnings, computed at generate and PERSISTED on the sheet.
 * All four keys are always present on the wire (contract-pinned); `toSalaryWarnings`
 * normalises anyway so a malformed payload degrades to "nothing to warn about" visibly
 * rather than crashing the editor.
 */
export interface SalarySheetWarnings {
  /** Working days with ZERO attendance rows company-wide (`YYYY-MM-DD`) — the outage signature. */
  daysWithNoRecords: string[];
  /** Employees dropped from the sheet, with the reason (e.g. `NO_PROJECT`). */
  skippedEmployees: { employeeId: string; reason: string }[];
  /** Per-employee unpaid-day count — includes zero rows; only `> 0` entries warn. */
  employeeAbsences: { employeeId: string; unpaidDays: number }[];
  /** True when no weekly holidays are configured — every calendar day counts as working. */
  noWeeklyHolidaysConfigured: boolean;
}

export function toSalaryWarnings(raw: unknown): SalarySheetWarnings {
  const w = (raw ?? {}) as Partial<SalarySheetWarnings>;
  return {
    daysWithNoRecords: Array.isArray(w.daysWithNoRecords) ? w.daysWithNoRecords : [],
    skippedEmployees: Array.isArray(w.skippedEmployees) ? w.skippedEmployees : [],
    employeeAbsences: Array.isArray(w.employeeAbsences) ? w.employeeAbsences : [],
    noWeeklyHolidaysConfigured: w.noWeeklyHolidaysConfigured === true,
  };
}

/**
 * Full sheet with its lines (used by the editor page). `warnings` is a DETAIL-read field —
 * served by `GET …/sheets/:id`, deliberately absent from the list response — and is the
 * stored generate-time snapshot, so the poster sees the gaps that belong to the figures
 * being posted (the generator is frequently not the poster).
 */
export interface SalarySheet extends SalarySheetSummary {
  lines: SalarySheetLine[];
  warnings?: SalarySheetWarnings | null;
}

export interface SalarySheetListFilter {
  financialYearId?: string;
  periodLabel?: string;
  status?: SalarySheetStatus;
  page?: number;
  pageSize?: number;
}

export interface SalarySheetPage {
  data: SalarySheetSummary[];
  page: number;
  pageSize: number;
  total: number;
}

function buildQuery(f: SalarySheetListFilter): string {
  const p = new URLSearchParams();
  if (f.financialYearId) p.set("financialYearId", f.financialYearId);
  if (f.periodLabel) p.set("periodLabel", f.periodLabel);
  if (f.status) p.set("status", f.status);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? 50));
  return p.toString();
}

export async function listSalarySheets(f: SalarySheetListFilter = {}): Promise<SalarySheetPage> {
  const res = await apiClient.get<{
    data: SalarySheetSummary[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(f)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? f.page ?? 1,
    pageSize: meta.pageSize ?? f.pageSize ?? 50,
    total: meta.total ?? res.data.length,
  };
}

export async function getSalarySheet(id: string, includeLines = true): Promise<SalarySheet> {
  const q = includeLines ? "?includeLines=true" : "";
  const res = await apiClient.get<{ data: SalarySheet }>(`${BASE}/${encodeURIComponent(id)}${q}`);
  return res.data;
}

// ── Generate ──
export interface GenerateSheetInput {
  financialYearId: string;
  periodLabel: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  projectId: string;
  /** Applied to every generated line (accrual/salary matrix requires purpose). Project-scoped MAS master. */
  purposeId: string;
}

export interface GenerateSheetResult {
  id: string;
  status: "DRAFT";
  periodLabel: string;
  /** The FR-HR-013a pre-post warnings the `201` carries (also persisted on the sheet). */
  warnings: SalarySheetWarnings;
}

export async function generateSalarySheet(input: GenerateSheetInput): Promise<GenerateSheetResult> {
  const res = await apiClient.post<{
    data: Omit<GenerateSheetResult, "warnings"> & { warnings?: unknown };
  }>(`${BASE}/generate`, input, csrf());
  return { ...res.data, warnings: toSalaryWarnings(res.data.warnings) };
}

// ── Per-line edit ──
export interface SalaryLineUpdateInput {
  allowances?: string;
  tdsAmount?: string;
  tdsRate?: string | null;
  pfAmount?: string;
  advanceRecovery?: string;
  otherDeductions?: string;
  version: number;
}

export interface SalaryLineUpdateResult {
  line: SalarySheetLine;
  totals: { totalGross: string; totalDeductions: string; totalNet: string };
  version: number;
}

export async function updateSalaryLine(
  sheetId: string,
  lineId: string,
  input: SalaryLineUpdateInput,
): Promise<SalaryLineUpdateResult> {
  const res = await apiClient.patch<{ data: SalaryLineUpdateResult }>(
    `${BASE}/${encodeURIComponent(sheetId)}/lines/${encodeURIComponent(lineId)}`,
    input,
    csrf(),
  );
  return res.data;
}

// ── Bulk component apply ──
export interface BulkComponentApply {
  allowances?: string;
  tdsRate?: string; // percent
  pfAmount?: string;
  advanceRecovery?: string;
}

export interface BulkComponentInput {
  apply: BulkComponentApply;
  employeeIds?: string[] | null; // omit → all lines
  version: number;
}

export interface BulkComponentResult {
  totals: { totalGross: string; totalDeductions: string; totalNet: string };
  changedLineCount: number;
  version: number;
}

export async function applyBulkComponents(
  sheetId: string,
  input: BulkComponentInput,
): Promise<BulkComponentResult> {
  const res = await apiClient.patch<{ data: BulkComponentResult }>(
    `${BASE}/${encodeURIComponent(sheetId)}/components`,
    input,
    csrf(),
  );
  return res.data;
}

// ── Post (the salary posting) ──
export interface PostSalaryInput {
  version: number;
}

export interface PostSalaryResult {
  salarySheetId: string;
  salaryEntryId: string;
  entryNo: string;
  status: "POSTED";
  postedAt: string;
  postedBy: string;
  version: number;
}

export async function postSalarySheet(
  sheetId: string,
  input: PostSalaryInput,
): Promise<PostSalaryResult> {
  const res = await apiClient.post<{ data: PostSalaryResult }>(
    `${BASE}/${encodeURIComponent(sheetId)}/post`,
    input,
    csrf(),
  );
  return res.data;
}

// ── Reverse ──
export interface ReverseSalaryInput {
  reason: string;
  version: number;
}

export interface ReverseSalaryResult {
  reversalEntryId: string;
  reversalEntryNo: string;
  originalEntryId: string;
  status: "REVERSED";
  version: number;
}

export async function reverseSalarySheet(
  sheetId: string,
  input: ReverseSalaryInput,
): Promise<ReverseSalaryResult> {
  const res = await apiClient.post<{ data: ReverseSalaryResult }>(
    `${BASE}/${encodeURIComponent(sheetId)}/reverse`,
    input,
    csrf(),
  );
  return res.data;
}

// ── Payslips (reused by FE-38) ──
export interface Payslip {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  periodLabel: string;
  paidDays: string;
  grossAmount: string;
  allowances: string;
  deductions: { tds: string; pf: string; advanceRecovery: string; other: string };
  netAmount: string;
}

export async function getSheetPayslips(sheetId: string, employeeId?: string): Promise<Payslip[]> {
  const q = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
  const res = await apiClient.get<{ data: Payslip[] }>(
    `${BASE}/${encodeURIComponent(sheetId)}/payslips${q}`,
  );
  return res.data;
}

// ── Attendance settings (read-only here — the editor is Company settings) ──
export interface AttendanceSettings {
  /** `HH:MM` late cut-off, e.g. `09:30`. */
  lateAfter: string;
  /** N late days cost one day's pay (FR-HR-008c/-013a). Interpolated into copy, never hard-coded. */
  latesPerDeductedDay: number;
}

/**
 * `GET /api/settings/attendance` (whole-body envelope exception, like `/holidays/*`).
 * The salary screen only READS this — the tooltip that explains the Late column must name
 * the company's actual divisor, not an assumed `3`.
 */
export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const raw = await apiClient.get<unknown>("/settings/attendance");
  const body = (raw ?? {}) as { lateAfter?: unknown; latesPerDeductedDay?: unknown };
  return {
    lateAfter: typeof body.lateAfter === "string" ? body.lateAfter : "09:30",
    latesPerDeductedDay:
      typeof body.latesPerDeductedDay === "number" && body.latesPerDeductedDay >= 1
        ? body.latesPerDeductedDay
        : 3,
  };
}

// ── Financial-year options (HR-local — do not import features/master-data) ──
export interface FinancialYearOption {
  id: string;
  code: string;
}

interface FinancialYearApiRow {
  id: string;
  label: string;
}

/**
 * The financial-year picker options for the Generate dialog + list filter. HR-local
 * binding (same pattern as `masters.ts`) to keep the `features/hr` → `features/master-data`
 * import boundary intact. The API returns `label`; mapped to `code` for the dropdown text.
 */
export async function listFinancialYearOptions(): Promise<FinancialYearOption[]> {
  try {
    const res = await apiClient.get<{ data: FinancialYearApiRow[] }>(
      "/masters/financial-years?page=1&pageSize=50",
    );
    return res.data.map((fy) => ({ id: fy.id, code: fy.label }));
  } catch {
    return [];
  }
}
