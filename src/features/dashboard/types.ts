/**
 * FE-61 DSH dashboard tile shapes (FR-DSH-001..018, contract 16). The FE
 * renders every KPI verbatim from the API — no client Σ, no re-round
 * (FR-DSH-004).
 */

export type TileKey =
  | "project-cash-flow"
  | "pending-ipcs"
  | "retention-held"
  | "low-stock"
  | "over-budget"
  | "attendance-summary"
  | "top-receivables-payables";

export type TileStatus = "OK" | "APPROACHING" | "OVER" | "BREACH" | null;

export interface DrillTo {
  report: string;
  params: Record<string, string | number | null>;
}

/* ─── Per-tile KPI shapes (contract 16 § Per-tile KPI shapes) ─── */

export interface CashFlowKpi {
  netInflow: string;
  cashBalance: string;
  bankBalance: string;
}

export interface PendingIpcKpi {
  count: number;
  totalOutstanding: string;
}

export interface RetentionHeldKpi {
  totalRetentionHeld: string;
}

export interface LowStockKpi {
  count: number;
}

export interface OverBudgetKpi {
  overCount: number;
  approachingCount: number;
}

export interface AttendanceKpi {
  /** YYYY-MM */
  period: string;
  presentDays: number;
  /** Decimal string (fractional head-count possible for daily-labour). */
  headCountTotal: string;
}

export interface TopPartyRow {
  partyId: string;
  partyName: string;
  outstanding: string;
}
export interface TopReceivablePayableKpi {
  topReceivables: TopPartyRow[];
  topPayables: TopPartyRow[];
}

export type TileKpi =
  | CashFlowKpi
  | PendingIpcKpi
  | RetentionHeldKpi
  | LowStockKpi
  | OverBudgetKpi
  | AttendanceKpi
  | TopReceivablePayableKpi;

export interface Tile {
  key: TileKey;
  title: string;
  kpi: TileKpi;
  status: TileStatus;
  drillTo: DrillTo;
  /** ISO-8601 UTC — when this tile was computed. */
  generatedAt: string;
}

export interface DashboardScope {
  financialYearId: string;
  projectId: string | null;
}

/** Map a drill-through's `report` name → the `/reports/…` route the FE navigates to. */
export function routeForReport(report: string): string {
  switch (report) {
    case "cash-bank-book":
    case "account-ledger":
    case "trial-balance":
    case "daybook":
      return "/reports/trial-balance-ledgers";
    case "profit-and-loss":
    case "balance-sheet":
      return "/reports/financial-statements";
    case "ipc-billing":
    case "project-pnl":
    case "outstanding":
    case "material-consumption-vs-budget":
    case "labour-cost":
    case "cost-centre-variance":
    case "requisition-vs-issue":
      return report === "cost-centre-variance" || report === "requisition-vs-issue"
        ? "/reports/requisition-cost-control"
        : "/reports/project-ipc";
    case "low-stock":
    case "stock-valuation":
    case "stock-transfer-summary":
      return "/reports/inventory";
    case "attendance-summary":
    case "salary-register":
    case "employee-payment-history":
      return "/reports/hr";
    default:
      return "/reports";
  }
}
