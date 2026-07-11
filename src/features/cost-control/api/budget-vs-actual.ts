import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type BudgetVsActualPage, type BudgetVsActualRow } from "../types";

/**
 * Budget-vs-actual API binding (API contract 06 § `GET /api/cost-control/budget-vs-actual`;
 * FR-CC-006/007/008/011/012/015). READ-ONLY GET — a query over the LED ledger + MAS
 * budgets, never a separate subsystem. `companyId` implicit from the JWT; the server
 * scopes a PM to assigned projects and re-checks (`403 FORBIDDEN`). Omitting
 * `financialYearId`/date filters yields the lifetime-cumulative figure (authoritative
 * for status); supplying them narrows `actualCost` to a reporting window only.
 */

const BASE = "/cost-control/budget-vs-actual";

export interface BudgetVsActualQuery {
  projectId?: string;
  costCentreId?: string;
  financialYearId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  status?: string; // csv enum OK,APPROACHING,OVER,UNBUDGETED
  page?: number;
  pageSize?: number;
}

function buildQuery(q: BudgetVsActualQuery): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("projectId", q.projectId);
  set("costCentreId", q.costCentreId);
  set("financialYearId", q.financialYearId);
  set("dateFrom", q.dateFrom);
  set("dateTo", q.dateTo);
  set("status", q.status);
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

/** Fetch budget-vs-actual rows for the caller's company (server restricts a PM to assigned projects). */
export async function getBudgetVsActual(q: BudgetVsActualQuery = {}): Promise<BudgetVsActualPage> {
  const res = await apiClient.get<{
    data: BudgetVsActualRow[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(q)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? q.page ?? 1,
    pageSize: meta.pageSize ?? q.pageSize ?? DEFAULT_PAGE_SIZE,
    total: meta.total ?? res.data.length,
  };
}
