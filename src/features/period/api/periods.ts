import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type AccountingPeriod,
  type GeneratePeriodsResult,
  type CloseFyResult,
} from "../types";

/**
 * Accounting Period Control (PER) API bindings (API contract 04-period-control).
 * Thin named wrappers over the configured apiClient -> the BFF (`/api/periods`).
 * The backend uses the central response model `{ data, meta }`; these unwrap
 * `.data`. State-changing calls echo the double-submit CSRF token (skill §4).
 *
 * Import boundary: features import `@/lib/api`, never `@/lib/api/generated/*`.
 */

const BASE = "/periods";

interface Envelope<T> {
  data: T;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/** GET periods for one financial year, ordered by `startDate` asc (server-ordered). */
export async function listPeriods(financialYearId: string): Promise<AccountingPeriod[]> {
  const p = new URLSearchParams({ financialYearId, pageSize: "100" });
  const res = await apiClient.get<Envelope<AccountingPeriod[]>>(`${BASE}?${p.toString()}`);
  return res.data;
}

/** Generate the standard monthly period set for an FY (Admin, `period.generate`). */
export async function generatePeriods(financialYearId: string): Promise<GeneratePeriodsResult> {
  const res = await apiClient.post<Envelope<GeneratePeriodsResult>>(
    `${BASE}/generate`,
    { financialYearId },
    csrf(),
  );
  return res.data;
}

/** Close one OPEN period -> CLOSED (Accounts Team / Admin, `period.close`). No body. */
export async function closePeriod(id: string): Promise<AccountingPeriod> {
  const res = await apiClient.post<Envelope<AccountingPeriod>>(`${BASE}/${id}/close`, {}, csrf());
  return res.data;
}

/** Reopen one CLOSED period -> OPEN (Admin only, `period.reopen`). No body. */
export async function reopenPeriod(id: string): Promise<AccountingPeriod> {
  const res = await apiClient.post<Envelope<AccountingPeriod>>(`${BASE}/${id}/reopen`, {}, csrf());
  return res.data;
}

/** Close every remaining OPEN period of the FY in one transaction (Admin, `period.close`). */
export async function closeFinancialYear(financialYearId: string): Promise<CloseFyResult> {
  const res = await apiClient.post<Envelope<CloseFyResult>>(
    `${BASE}/close-fy`,
    { financialYearId },
    csrf(),
  );
  return res.data;
}
