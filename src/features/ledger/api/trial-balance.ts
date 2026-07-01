import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type TrialBalancePage, type TrialBalanceRow, type TrialBalanceTotals } from "../types";

/**
 * Trial-balance API binding (API contract 02 § `GET /api/ledger/trial-balance`;
 * FR-LED-031/001/014/007). READ-ONLY GET — a query over the single general ledger,
 * never a separate subsystem; `companyId` implicit from the JWT. `periodId` (as-of)
 * takes precedence over `dateFrom`/`dateTo` when both are supplied — the server
 * resolves precedence; the FE only requests whichever the reader applied. Grouping
 * columns not requested via `groupBy` come back `null`. No CSRF (read).
 */

const BASE = "/ledger/trial-balance";

/** Query filters for the trial balance (all optional; AND-combined per the contract). */
export interface TrialBalanceFilter {
  financialYearId?: string;
  periodId?: string;
  dateFrom?: string; // YYYY-MM-DD; ignored server-side when periodId is supplied
  dateTo?: string; // YYYY-MM-DD; ignored server-side when periodId is supplied
  groupBy?: string; // csv enum: account,project,cost_centre,purpose,godown,party
  projectId?: string;
  costCentreId?: string;
  purposeId?: string;
  godownId?: string;
  partyId?: string;
  accountId?: string;
  includeReversals?: boolean;
  page?: number;
  pageSize?: number;
}

function buildQuery(filter: TrialBalanceFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("financialYearId", filter.financialYearId);
  set("periodId", filter.periodId);
  set("dateFrom", filter.dateFrom);
  set("dateTo", filter.dateTo);
  set("groupBy", filter.groupBy);
  set("projectId", filter.projectId);
  set("costCentreId", filter.costCentreId);
  set("purposeId", filter.purposeId);
  set("godownId", filter.godownId);
  set("partyId", filter.partyId);
  set("accountId", filter.accountId);
  if (filter.includeReversals !== undefined) {
    p.set("includeReversals", String(filter.includeReversals));
  }
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

const ZERO_TOTALS: TrialBalanceTotals = { debit: "0.0000", credit: "0.0000" };

/** Fetch the aggregated trial balance for the caller's company (server restricts a PM to assigned projects). */
export async function getTrialBalance(filter: TrialBalanceFilter = {}): Promise<TrialBalancePage> {
  const res = await apiClient.get<{
    data: TrialBalanceRow[];
    totals?: TrialBalanceTotals;
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(filter)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    totals: res.totals ?? ZERO_TOTALS,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? DEFAULT_PAGE_SIZE,
    total: meta.total ?? res.data.length,
  };
}
