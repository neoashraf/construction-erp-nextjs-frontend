import { apiClient } from "@/lib/api";
import { type Paginated, DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type JournalEntryHeader } from "../types";

/**
 * Journal-entries API binding (API contract 02 § `GET /api/ledger/entries`). The
 * ledger is READ-ONLY over HTTP — this is a GET only; there is NO create/edit/delete
 * call (posting is internal to the voucher modules via PostingService). `companyId`
 * is implicit from the JWT (never sent). Central `{ data, meta }` envelope; no CSRF
 * (read). All filters AND-combine server-side.
 */

const BASE = "/ledger/entries";

/** Query filters for the entries list (all optional; AND-combined per the contract). */
export interface JournalEntriesFilter {
  financialYearId?: string;
  periodId?: string;
  voucherType?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  sourceType?: string;
  sourceId?: string;
  entryNo?: string;
  /** undefined = all; true = reversal-only; false = normal-only (design tri-state). */
  isReversal?: boolean;
  projectId?: string;
  costCentreId?: string;
  purposeId?: string;
  godownId?: string;
  accountId?: string;
  partyId?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(filter: JournalEntriesFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("financialYearId", filter.financialYearId);
  set("periodId", filter.periodId);
  set("voucherType", filter.voucherType);
  set("dateFrom", filter.dateFrom);
  set("dateTo", filter.dateTo);
  set("sourceType", filter.sourceType);
  set("sourceId", filter.sourceId);
  set("entryNo", filter.entryNo);
  if (filter.isReversal !== undefined) p.set("isReversal", String(filter.isReversal));
  set("projectId", filter.projectId);
  set("costCentreId", filter.costCentreId);
  set("purposeId", filter.purposeId);
  set("godownId", filter.godownId);
  set("accountId", filter.accountId);
  set("partyId", filter.partyId);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

/** List posted journal-entry headers (no lines) for the caller's company. */
export async function listJournalEntries(
  filter: JournalEntriesFilter = {},
): Promise<Paginated<JournalEntryHeader>> {
  const res = await apiClient.get<{
    data: JournalEntryHeader[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(filter)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? DEFAULT_PAGE_SIZE,
    total: meta.total ?? res.data.length,
  };
}
