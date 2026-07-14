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
  projectId: string | null;
  costCentreId: string | null; // always the Labour cost centre
  purposeId: string | null;
  paidDays: string; // Decimal(18,3)
  grossAmount: string; // Decimal(18,4) — read-only
  allowances: string; // editable in DRAFT
  tdsAmount: string;
  tdsRate: string | null; // percent (0..100)
  pfAmount: string;
  advanceRecovery: string;
  otherDeductions: string;
  netAmount: string; // read-only, server-computed
  version: number;
}

/** Full sheet with its lines (used by the editor page). */
export interface SalarySheet extends SalarySheetSummary {
  lines: SalarySheetLine[];
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
  projectId?: string | null;
}

export interface GenerateSheetResult {
  id: string;
  status: "DRAFT";
  periodLabel: string;
}

export async function generateSalarySheet(input: GenerateSheetInput): Promise<GenerateSheetResult> {
  const res = await apiClient.post<{ data: GenerateSheetResult }>(
    `${BASE}/generate`,
    input,
    csrf(),
  );
  return res.data;
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

// ── Financial-year options (HR-local — do not import features/master-data) ──
export interface FinancialYearOption {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

/**
 * The financial-year picker options for the Generate dialog + list filter. HR-local
 * binding (same pattern as `masters.ts`) to keep the `features/hr` → `features/master-data`
 * import boundary intact.
 */
export async function listFinancialYearOptions(): Promise<FinancialYearOption[]> {
  try {
    const res = await apiClient.get<{ data: FinancialYearOption[] }>(
      "/masters/financial-years?page=1&pageSize=50",
    );
    return res.data;
  } catch {
    return [];
  }
}
