import { type ReportCategory } from "./types";

/**
 * The full report roster per category, as `Reports.dc.html` draws it — the design's
 * chip row lists EVERY report in the active category (e.g. all four ledgers &
 * registers), not just the ones the API's catalog response happens to include.
 *
 * Each entry mirrors its viewer's own switcher chips (`ReportSwitcher`,
 * `HrReportSwitcher`, …): the `name` matches that viewer's `REPORT_NAME` map so
 * picking a chip opens the viewer on the right sub-report, and `tone` matches the
 * viewer's dot colour — violet = balance/as-of, blue = flow/date-range,
 * amber = budget-variance.
 *
 * This is presentation only. The catalog API stays authoritative for PERMISSIONS:
 * a category with no permitted report gets no tab, and the chips of a category are
 * intersected with what the caller may run (see `ReportCatalogScreen`).
 */
export type RosterTone = "violet" | "blue" | "amber";

export interface RosterEntry {
  name: string;
  title: string;
  tone: RosterTone;
}

export const CATEGORY_ROSTER: Record<ReportCategory, readonly RosterEntry[]> = {
  LEDGERS_REGISTERS: [
    { name: "trial-balance", title: "Trial balance", tone: "violet" },
    { name: "account-ledger", title: "Account ledger", tone: "blue" },
    { name: "daybook", title: "Journal register", tone: "blue" },
    { name: "cash-bank-book", title: "Cash & bank book", tone: "blue" },
  ],
  FINANCIAL_STATEMENTS: [
    { name: "profit-and-loss", title: "Profit & loss", tone: "blue" },
    { name: "balance-sheet", title: "Balance sheet", tone: "violet" },
  ],
  PROJECT_IPC: [
    { name: "project-pnl", title: "Project P&L", tone: "blue" },
    { name: "ipc-billing", title: "IPC report", tone: "blue" },
    { name: "outstanding", title: "Outstanding", tone: "violet" },
    {
      name: "material-consumption-vs-budget",
      title: "Material consumption vs budget",
      tone: "amber",
    },
    { name: "labour-cost", title: "Labour cost", tone: "amber" },
  ],
  INVENTORY: [
    { name: "stock-valuation", title: "Stock valuation", tone: "violet" },
    { name: "low-stock", title: "Low-stock", tone: "violet" },
    { name: "stock-transfer-summary", title: "Stock transfer summary", tone: "blue" },
  ],
  REQUISITION_COST_CONTROL: [
    { name: "requisition-vs-issue", title: "Requisition vs issue", tone: "blue" },
    { name: "cost-centre-variance", title: "Cost-centre variance", tone: "blue" },
  ],
  HR: [
    { name: "attendance-summary", title: "Attendance summary", tone: "violet" },
    { name: "salary-register", title: "Salary register", tone: "violet" },
    { name: "employee-payment-history", title: "Employee payment history", tone: "blue" },
  ],
};
