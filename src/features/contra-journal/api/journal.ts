import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type JournalVoucherSummary, type VoucherListPage } from "../types";

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
