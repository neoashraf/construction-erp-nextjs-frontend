/**
 * FE-57 fe-project-ipc-reports — per-report row + totals shapes (FR-RPT-015…020,
 * contract 15 § "Project reports"). Reuses the FE-54 `ReportResult<Row>` envelope.
 */

export type ProjectReportTab =
  | "PROJECT_PNL"
  | "IPC_BILLING"
  | "OUTSTANDING"
  | "MATERIAL_CONSUMPTION"
  | "LABOUR_COST";

/** Map the tab id → REST endpoint slug (path segment after `/reports/`). */
export const REPORT_NAME: Record<ProjectReportTab, string> = {
  PROJECT_PNL: "project-pnl",
  IPC_BILLING: "ipc-billing",
  OUTSTANDING: "outstanding",
  MATERIAL_CONSUMPTION: "material-consumption-vs-budget",
  LABOUR_COST: "labour-cost",
};

/** IPC ageing bucket (FR-RPT-017) — the one field RPT derives from raw dates. */
export type AgeingBucket = "CURRENT" | "D31_60" | "D61_90" | "D90_PLUS";

/** Cost-centre variance status (rendered verbatim from CC — FR-CC-011). */
export type CostCentreVarianceStatus =
  | "OK"
  | "APPROACHING"
  | "OVER"
  | "UNBUDGETED";

/** Project P&L — per-cost-centre revenue/cost/profit + a "Project total" row. */
export interface ProjectPnlRow {
  costCentreId: string | null;
  costCentreCode: string | null;
  costCentreName: string | null;
  revenue: string;
  cost: string;
  profit: string;
}

export interface ProjectPnlTotals {
  revenue: string;
  cost: string;
  profit: string;
}

/** IPC billing row — SAL's per-IPC certified/billed/received/outstanding + ageing. */
export interface IpcBillingRow {
  ipcId: string;
  ipcNo: string;
  ipcDate: string;
  dueDate: string;
  status?: string;
  projectId?: string;
  projectName?: string | null;
  certifiedAmount: string;
  billedAmount: string;
  receivedAmount: string;
  outstandingAmount: string;
  retentionHeldAmount: string;
  ageingBucket: AgeingBucket;
}

export interface IpcBillingTotals {
  certified: string;
  billed: string;
  received: string;
  outstanding: string;
  retentionHeld: string;
}

/** Per-project rolled-up totals (Outstanding — reconciles to Σ IPC outstanding). */
export type OutstandingProjectTotals = Record<string, IpcBillingTotals>;

/** Material-consumption-vs-budget row (rendered verbatim from CC). */
export interface CostCentreVarianceRow {
  projectId: string;
  projectName: string | null;
  costCentreId: string;
  costCentreCode: string;
  costCentreName: string | null;
  budgetedAmount: string | null;
  actualAmount: string;
  variance: string | null;
  utilisationPct: string | null;
  status: CostCentreVarianceStatus;
}

export interface CostCentreVarianceTotals {
  budgeted: string;
  actual: string;
  variance: string;
}

/** Labour-cost row — Project · Cost centre · labour EXPENSE. */
export interface LabourCostRow {
  projectId: string;
  projectName: string | null;
  costCentreId: string;
  costCentreCode: string;
  costCentreName: string | null;
  labourCost: string;
}

export interface LabourCostTotals {
  labourCost: string;
}
