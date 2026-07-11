/**
 * Cost-control view-model types (API contract 06 § Budget vs Actual). Money is a
 * `Decimal(18,4)` BDT JSON string; `utilisationPct` an exact decimal-string percent.
 * `budgetedAmount`/`variance`/`utilisationPct` are `null` for an `UNBUDGETED` row.
 * CC owns no entity and writes nothing — these are read projections over LED + MAS.
 */

export type BvaStatus = "OK" | "APPROACHING" | "OVER" | "UNBUDGETED";

/** Which dimension is the fixed filter vs. the grouping column (FR-CC-008). */
export type ViewMode = "project" | "cost_centre";

export interface BudgetVsActualRow {
  projectId: string;
  costCentreId: string;
  budgetedAmount: string | null;
  actualCost: string;
  variance: string | null;
  utilisationPct: string | null;
  status: BvaStatus;
}

export interface BudgetVsActualPage {
  data: BudgetVsActualRow[];
  page: number;
  pageSize: number;
  total: number;
}

/** Profitability grouping (API `groupBy`; FR-CC-009). */
export type ProfitGroupBy = "cost_centre" | "project" | "project_cost_centre";

/**
 * One profitability row (API contract 06 § Profitability). `revenue = Σ(credit−debit)`
 * on INCOME accounts; `cost = Σ(debit−credit)` on EXPENSE accounts; `profit = revenue −
 * cost` — all `Decimal(18,4)` BDT strings. Grouping columns not in `groupBy` are `null`.
 * No status/budget concept applies here (FR-CC-009 defines only revenue/cost/profit).
 */
export interface ProfitabilityRow {
  projectId: string | null;
  costCentreId: string | null;
  revenue: string;
  cost: string;
  profit: string;
}

export interface ProfitabilityPage {
  data: ProfitabilityRow[];
  page: number;
  pageSize: number;
  total: number;
}

/** Selector options (read-only MAS lookups; company implicit from the JWT). */
export interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
}
export interface CostCentreOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
export interface FinancialYearOption {
  id: string;
  label: string;
  isActive: boolean;
}
