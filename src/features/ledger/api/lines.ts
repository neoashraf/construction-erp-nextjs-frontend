import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type LedgerLine, type LedgerLinesPage } from "../types";

/**
 * Ledger-lines API binding (API contract 02 § `GET /api/ledger/lines`) — the account
 * ledger + dimension drill-down substrate. READ-ONLY GET; `companyId` implicit from
 * the JWT. In account-ledger mode (`accountId` + date range) the server adds a
 * top-level `openingBalance` and a per-row `runningBalance` (cumulative across pages);
 * in drill-down mode both are omitted. No CSRF (read).
 */

const BASE = "/ledger/lines";

/** Query filters for the lines list (all optional; AND-combined per the contract). */
export interface LedgerLinesFilter {
  accountId?: string;
  financialYearId?: string;
  periodId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  projectId?: string;
  costCentreId?: string;
  purposeId?: string;
  godownId?: string;
  partyId?: string;
  voucherType?: string;
  sourceType?: string;
  sourceId?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(filter: LedgerLinesFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("accountId", filter.accountId);
  set("financialYearId", filter.financialYearId);
  set("periodId", filter.periodId);
  set("dateFrom", filter.dateFrom);
  set("dateTo", filter.dateTo);
  set("projectId", filter.projectId);
  set("costCentreId", filter.costCentreId);
  set("purposeId", filter.purposeId);
  set("godownId", filter.godownId);
  set("partyId", filter.partyId);
  set("voucherType", filter.voucherType);
  set("sourceType", filter.sourceType);
  set("sourceId", filter.sourceId);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

/**
 * List journal lines for the caller's company. Account-ledger mode requires an
 * `accountId` (+ date range) to get `openingBalance` + `runningBalance`; without an
 * account it is drill-down mode (both omitted).
 */
export async function listLedgerLines(filter: LedgerLinesFilter = {}): Promise<LedgerLinesPage> {
  const res = await apiClient.get<{
    data: LedgerLine[];
    openingBalance?: string | null;
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(filter)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    openingBalance: res.openingBalance ?? null,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? DEFAULT_PAGE_SIZE,
    total: meta.total ?? res.data.length,
  };
}
