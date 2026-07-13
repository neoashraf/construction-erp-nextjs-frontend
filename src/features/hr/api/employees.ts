import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Employee, type EmployeeAssignment, type EmployeePage, type EmployeeSummary } from "../types";

/**
 * HR Employees API bindings (API contract 12 § "Employees"; FR-HR-001, -002, -003). The
 * Employee master is **not a voucher** — it carries no posting dimensions and never touches
 * the ledger; create/edit persist immediately (subject to optimistic-lock + validation).
 * Bank fields are masked on standard reads (NFR-002); a `?reveal=true` GET returns the raw
 * values for `hr:employee:write` holders (HR Manager / Admin) and is audited server-side.
 * `companyId` is implicit from the JWT. Shared with fe-attendance + fe-salary-sheet.
 */

const BASE = "/hr/employees";

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface EmployeeListFilter {
  status?: string; // csv of ACTIVE,INACTIVE
  defaultProjectId?: string;
  wageType?: string; // MONTHLY | DAILY
  q?: string; // code / name typeahead
  page?: number;
  pageSize?: number;
}

/** The create body (contract 12 § "POST /api/hr/employees"). */
export interface EmployeeCreateInput {
  employeeCode: string;
  name: string;
  designation: string | null;
  defaultProjectId: string | null;
  department: string | null;
  workBase: "HEAD_OFFICE" | "SITE";
  wageType: "MONTHLY" | "DAILY";
  wageAmount: string; // Decimal(18,4)
  bankAccountName: string | null;
  bankAccountNo: string | null;
  bankName: string | null;
  pfApplicable: boolean;
  gratuityApplicable: boolean;
  wppfApplicable: boolean;
  tin: string | null;
  joiningDate: string; // YYYY-MM-DD
}

/** The PATCH body (contract 12) — `employeeCode` is immutable once referenced. */
export type EmployeeUpdateInput = Partial<Omit<EmployeeCreateInput, "employeeCode" | "joiningDate">> & {
  version: number;
};

export interface ReassignInput {
  projectId: string;
  effectiveDate: string; // YYYY-MM-DD
  note: string | null;
  version: number;
}

function buildQuery(f: EmployeeListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("status", f.status);
  set("defaultProjectId", f.defaultProjectId);
  set("wageType", f.wageType);
  set("q", f.q);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listEmployees(f: EmployeeListFilter = {}): Promise<EmployeePage> {
  const res = await apiClient.get<{
    data: EmployeeSummary[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(f)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? f.page ?? 1,
    pageSize: meta.pageSize ?? f.pageSize ?? DEFAULT_PAGE_SIZE,
    total: meta.total ?? res.data.length,
  };
}

/**
 * Read an employee by id. Pass `reveal: true` to request the raw bank fields — the server
 * enforces `hr:employee:write` (HR/Admin) and audits the access (NFR-002). The Accounts
 * read-only path always uses `reveal: false` and receives masked values.
 */
export async function getEmployee(id: string, opts: { reveal?: boolean } = {}): Promise<Employee> {
  const q = opts.reveal ? "?reveal=true" : "";
  const res = await apiClient.get<{ data: Employee }>(`${BASE}/${id}${q}`);
  return res.data;
}

/** Create — persists immediately (`status=ACTIVE`, `version=1`). Returns the new id. */
export async function createEmployee(input: EmployeeCreateInput): Promise<{ id: string }> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return res.data;
}

/** Edit the descriptive / pay / bank fields (contract 12); `employeeCode` immutable once referenced. */
export async function updateEmployee(id: string, input: EmployeeUpdateInput): Promise<Employee> {
  const res = await apiClient.patch<{ data: Employee }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/**
 * Reassign — appends a new EmployeeAssignment row (never overwrites) + updates
 * `defaultProjectId` (FR-HR-002). `effectiveDate < joiningDate` → 400 VALIDATION_ERROR.
 */
export async function reassignEmployee(id: string, input: ReassignInput): Promise<Employee> {
  const res = await apiClient.post<{ data: Employee }>(`${BASE}/${id}/reassign`, input, csrf());
  return res.data;
}

/** The append-only assignment history for an employee (newest-first). */
export async function listAssignments(id: string): Promise<EmployeeAssignment[]> {
  const res = await apiClient.get<{ data: EmployeeAssignment[] }>(`${BASE}/${id}/assignments`);
  return res.data;
}

/** Deactivate — excludes the employee from new attendance / salary cycles (FR-HR-003). */
export async function deactivateEmployee(id: string, version: number): Promise<Employee> {
  const res = await apiClient.post<{ data: Employee }>(`${BASE}/${id}/deactivate`, { version }, csrf());
  return res.data;
}

/** Reactivate — inverse of deactivate; history unaffected (FR-HR-003). */
export async function reactivateEmployee(id: string, version: number): Promise<Employee> {
  const res = await apiClient.post<{ data: Employee }>(`${BASE}/${id}/reactivate`, { version }, csrf());
  return res.data;
}
