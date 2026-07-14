import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type ContraVoucher, type ContraVoucherSummary, type VoucherListPage } from "../types";

/**
 * Contra Voucher API bindings (API contract 14). List + full write surface — the
 * FE-49 editor lifecycle: create/get/patch/delete + POST /post + POST /reverse.
 * Money is `Decimal(18,4)` JSON strings; dates `YYYY-MM-DD`. Company implicit from JWT.
 */

const BASE = "/contra";

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface ContraListFilter {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  entryNo?: string;
  accountId?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(f: ContraListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("status", f.status);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  set("entryNo", f.entryNo);
  set("accountId", f.accountId);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listContraVouchers(f: ContraListFilter = {}): Promise<VoucherListPage> {
  const res = await apiClient.get<{
    data: ContraVoucherSummary[];
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

// ── Editor write surface (FE-49) ────────────────────────────────────────────────────

export interface ContraLineInput {
  accountId: string;
  debit: string;
  credit: string;
  narration: string | null;
}
export interface ContraWriteInput {
  voucherDate: string; // YYYY-MM-DD
  narration: string | null;
  lines: ContraLineInput[];
}

export async function getContraVoucher(id: string): Promise<ContraVoucher> {
  const res = await apiClient.get<{ data: ContraVoucher }>(`${BASE}/${id}`);
  return res.data;
}

export async function createContraVoucher(input: ContraWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return res.data;
}

export async function updateContraVoucher(
  id: string,
  input: ContraWriteInput & { version: number },
): Promise<ContraVoucher> {
  const res = await apiClient.patch<{ data: ContraVoucher }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deleteContraVoucher(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`, csrf());
}

export interface ContraPostResult {
  id: string;
  entryNo: string;
  journalEntryId: string;
  status: "POSTED";
}
export async function postContraVoucher(id: string, version: number): Promise<ContraPostResult> {
  const res = await apiClient.post<{ data: ContraPostResult }>(
    `${BASE}/${id}/post`,
    { version },
    csrf(),
  );
  return res.data;
}

export interface ContraReverseResult {
  id: string;
  status: "CANCELLED";
  reversalEntryId: string;
  reversalEntryNo: string;
}
export async function reverseContraVoucher(
  id: string,
  input: { reason: string; version: number },
): Promise<ContraReverseResult> {
  const res = await apiClient.post<{ data: ContraReverseResult }>(
    `${BASE}/${id}/reverse`,
    input,
    csrf(),
  );
  return res.data;
}
