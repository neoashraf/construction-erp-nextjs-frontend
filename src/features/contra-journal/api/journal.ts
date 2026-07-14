import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type JournalVoucher, type JournalVoucherSummary, type VoucherListPage } from "../types";

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/**
 * Journal Voucher API bindings (API contract 14). Both hand-keyed journals and the
 * one-time opening journal ride `/api/journal` — the list here filters on
 * `voucherType` (`JOURNAL | OPENING`). Money is `Decimal(18,4)` JSON strings; dates
 * `YYYY-MM-DD`. Company implicit from JWT.
 */

const BASE = "/journal";

export interface JournalListFilter {
  voucherType?: string; // JOURNAL | OPENING
  status?: string; // csv of VoucherStatus
  dateFrom?: string;
  dateTo?: string;
  entryNo?: string;
  accountId?: string;
  partyId?: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(f: JournalListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("voucherType", f.voucherType);
  set("status", f.status);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  set("entryNo", f.entryNo);
  set("accountId", f.accountId);
  set("partyId", f.partyId);
  set("projectId", f.projectId);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listJournalVouchers(f: JournalListFilter = {}): Promise<VoucherListPage> {
  const res = await apiClient.get<{
    data: JournalVoucherSummary[];
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

// ── Editor write surface (FE-50) ────────────────────────────────────────────────────

export interface JournalLineInput {
  accountId: string;
  debit: string;
  credit: string;
  partyId: string | null;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  narration: string | null;
}
export interface JournalWriteInput {
  voucherDate: string;
  narration: string | null;
  lines: JournalLineInput[];
}

export async function getJournalVoucher(id: string): Promise<JournalVoucher> {
  const res = await apiClient.get<{ data: JournalVoucher }>(`${BASE}/${id}`);
  return res.data;
}

export async function createJournalVoucher(input: JournalWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return res.data;
}

export async function updateJournalVoucher(
  id: string,
  input: JournalWriteInput & { version: number },
): Promise<JournalVoucher> {
  const res = await apiClient.patch<{ data: JournalVoucher }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deleteJournalVoucher(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`, csrf());
}

export interface JournalPostResult {
  id: string;
  entryNo: string;
  journalEntryId: string;
  status: "POSTED";
}
export async function postJournalVoucher(id: string, version: number): Promise<JournalPostResult> {
  const res = await apiClient.post<{ data: JournalPostResult }>(
    `${BASE}/${id}/post`,
    { version },
    csrf(),
  );
  return res.data;
}

export interface JournalReverseResult {
  id: string;
  status: "CANCELLED";
  reversalEntryId: string;
  reversalEntryNo: string;
}
export async function reverseJournalVoucher(
  id: string,
  input: { reason: string; version: number },
): Promise<JournalReverseResult> {
  const res = await apiClient.post<{ data: JournalReverseResult }>(
    `${BASE}/${id}/reverse`,
    input,
    csrf(),
  );
  return res.data;
}
