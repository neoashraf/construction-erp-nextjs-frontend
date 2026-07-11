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
