import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type BudgetVsActualPage, type BudgetVsActualRow } from "../types";

/**
 * Over-budget alerts API binding (API contract 06 § `GET /api/cost-control/alerts`;
 * FR-CC-011/012/016). READ-ONLY GET — the current, LIVE list of `(project, cost centre)`
 * pairs classified `OVER` or `APPROACHING`, computed from the ledger (never a stored,
 * dismissible record). Same row shape as budget-vs-actual, only OVER/APPROACHING rows,
 * always lifetime-cumulative. `companyId` implicit from the JWT; the server always scopes
 * a PM to assigned projects and re-checks (`403 FORBIDDEN`) on a cross-scope project filter.
 */

const BASE = "/cost-control/alerts";

export interface OverBudgetAlertsQuery {
  status?: string; // csv, a subset of "OVER,APPROACHING"
  projectId?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(q: OverBudgetAlertsQuery): string {
  const p = new URLSearchParams();
  if (q.status) p.set("status", q.status);
  if (q.projectId) p.set("projectId", q.projectId);
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

/** Fetch the current OVER/APPROACHING alerts (server restricts a PM to assigned projects). */
export async function getOverBudgetAlerts(q: OverBudgetAlertsQuery = {}): Promise<BudgetVsActualPage> {
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
