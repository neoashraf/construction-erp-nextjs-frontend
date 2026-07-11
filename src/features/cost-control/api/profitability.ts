import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type ProfitabilityPage, type ProfitabilityRow, type ProfitGroupBy } from "../types";

/**
 * Profitability API binding (API contract 06 § `GET /api/cost-control/profitability`;
 * FR-CC-009/010). READ-ONLY GET — revenue/cost/profit grouped by cost centre and/or
 * project, a query over the LED ledger (INCOME + EXPENSE). Unlike budget-vs-actual there
 * is no budget/status side. `companyId` implicit from the JWT; the server re-checks access
 * (`403 FORBIDDEN`) on an out-of-scope project/cost-centre filter.
 */

const BASE = "/cost-control/profitability";

export interface ProfitabilityQuery {
  groupBy?: ProfitGroupBy;
  projectId?: string;
  costCentreId?: string;
  financialYearId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}

function buildQuery(q: ProfitabilityQuery): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("groupBy", q.groupBy);
  set("projectId", q.projectId);
  set("costCentreId", q.costCentreId);
  set("financialYearId", q.financialYearId);
  set("dateFrom", q.dateFrom);
  set("dateTo", q.dateTo);
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

/** Fetch profitability rows for the caller's company, grouped per `groupBy`. */
export async function getProfitability(q: ProfitabilityQuery = {}): Promise<ProfitabilityPage> {
  const res = await apiClient.get<{
    data: ProfitabilityRow[];
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
