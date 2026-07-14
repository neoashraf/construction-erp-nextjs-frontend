import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listContraVouchers, type ContraListFilter } from "../api/contra";
import { listJournalVouchers, type JournalListFilter } from "../api/journal";
import { type AnyVoucherSummary, type VoucherListPage } from "../types";

/**
 * Unified voucher list (spec §5/§9; FR-GEN-020). The `type` chip drives the underlying
 * endpoint(s) — `CONTRA` → `GET /api/contra`; `JOURNAL`/`OPENING` → `GET /api/journal`
 * with `voucherType`; `ALL` merges both client-side and sorts `voucherDate` desc. Keys
 * are tenant/FY-scoped so a company/FY switch evicts the cache; `placeholderData`
 * keeps the previous page visible while a new filter/page loads.
 */

export type UnifiedListFilter = {
  type: "ALL" | "CONTRA" | "JOURNAL" | "OPENING";
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  entryNo?: string;
  accountId?: string;
  partyId?: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
};

async function fetchUnified(f: UnifiedListFilter): Promise<VoucherListPage> {
  if (f.type === "CONTRA") {
    return listContraVouchers(sharedContra(f));
  }
  if (f.type === "JOURNAL" || f.type === "OPENING") {
    return listJournalVouchers({ ...sharedJournal(f), voucherType: f.type });
  }
  // ALL — merge both, newest-first.
  const [contra, journal] = await Promise.all([
    listContraVouchers(sharedContra(f)),
    listJournalVouchers(sharedJournal(f)),
  ]);
  const rows: AnyVoucherSummary[] = [...contra.data, ...journal.data].sort((a, b) =>
    a.voucherDate < b.voucherDate ? 1 : -1,
  );
  return {
    data: rows,
    page: f.page ?? 1,
    pageSize: f.pageSize ?? contra.pageSize,
    total: contra.total + journal.total,
  };
}

function sharedContra(f: UnifiedListFilter): ContraListFilter {
  return {
    status: f.status,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    entryNo: f.entryNo,
    accountId: f.accountId,
    page: f.page,
    pageSize: f.pageSize,
  };
}
function sharedJournal(f: UnifiedListFilter): JournalListFilter {
  return {
    status: f.status,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    entryNo: f.entryNo,
    accountId: f.accountId,
    partyId: f.partyId,
    projectId: f.projectId,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export function useVoucherList(filter: UnifiedListFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("contra-journal", "vouchers", scope, { ...filter }),
    queryFn: () => fetchUnified(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
