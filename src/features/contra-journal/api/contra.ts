import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type ContraVoucherSummary, type VoucherListPage } from "../types";

/**
 * Contra Voucher API bindings (API contract 14). The list read is used here (FE-48);
 * FE-49's editor extends this file with get-by-id/create/patch/delete/post/reverse.
 * Money is `Decimal(18,4)` JSON strings; dates `YYYY-MM-DD`. Company implicit from JWT.
 */

const BASE = "/contra";

export interface ContraListFilter {
  status?: string; // csv of VoucherStatus
  dateFrom?: string; // YYYY-MM-DD
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
