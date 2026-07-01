import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type FinancialYear } from "../types";

/**
 * Financial-years API bindings (API contract 01 § Financial Years). Thin named
 * wrappers over the configured apiClient → the BFF (`/api/masters/financial-years`).
 * The backend uses the central response model `{ data, meta }`; these unwrap `.data`.
 * State-changing calls echo the double-submit CSRF token (skill §4).
 *
 * Import boundary: features import `@/lib/api`, never `@/lib/api/generated/*`.
 */

const BASE = "/masters/financial-years";

interface Envelope<T> {
  data: T;
}

export interface FinancialYearFilter {
  /** Active/All filter → `?isActive=true`; omit for all. */
  isActive?: boolean;
}

export interface CreateFinancialYearInput {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface UpdateFinancialYearInput extends CreateFinancialYearInput {
  version: number;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/** GET the company's financial years (optionally only the active one). */
export async function listFinancialYears(
  filter: FinancialYearFilter = {},
): Promise<FinancialYear[]> {
  const qs = filter.isActive ? "?isActive=true" : "";
  const res = await apiClient.get<Envelope<FinancialYear[]>>(`${BASE}${qs}`);
  return res.data;
}

/** POST a new financial year → returns the new id (overlap allowed). */
export async function createFinancialYear(
  input: CreateFinancialYearInput,
): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(BASE, input, csrf());
  return res.data;
}

/** PATCH a financial year (sends `version` for optimistic concurrency). */
export async function updateFinancialYear(
  id: string,
  input: UpdateFinancialYearInput,
): Promise<FinancialYear> {
  const res = await apiClient.patch<Envelope<FinancialYear>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** POST set-active → the now-active year (clears the previously active one). */
export async function setActiveFinancialYear(id: string): Promise<FinancialYear> {
  const res = await apiClient.post<Envelope<FinancialYear>>(`${BASE}/${id}/set-active`, {}, csrf());
  return res.data;
}
