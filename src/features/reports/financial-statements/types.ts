/**
 * FE-55 P&L + Balance-sheet row + totals view types (SRS §8 / FR-RPT-013/014).
 * `ProjectPnlRow` mirrors the RPT contract; `BalanceSheetRow` groups by
 * `AccountGroup`. All money fields are `Decimal(18,4)` **strings** — never
 * client-recomputed (FR-RPT-030).
 */

export type StatementTab = "PNL" | "BS";
export type Scope = "CONSOLIDATED" | "PROJECT_WISE";
export type PnlGroupBy = "account" | "cost_centre" | "project" | "project_cost_centre";

/** Account section kinds the P&L result groups rows under. */
export type PnlSectionKind = "INCOME" | "EXPENSE";

export interface ProjectPnlRow {
  accountId: string;
  accountCode: string;
  accountName: string | null;
  /** "(inactive)" tag if the account was deactivated after posting. */
  isActive?: boolean;
  section: PnlSectionKind;
  /** Optional cost-centre sub-row context — only when `groupBy` includes cost centre. */
  costCentreId?: string | null;
  costCentreName?: string | null;
  /** Optional project context — only when `groupBy` includes project. */
  projectId?: string | null;
  projectName?: string | null;
  /** Signed Decimal(18,4) string; positive = revenue for INCOME, cost for EXPENSE. */
  amount: string;
}

export interface PnlTotals {
  revenue: string;
  cost: string;
  profit: string; // signed; loss = negative
}

/** Balance-sheet row — sectioned by `groupKind` for the shell to render. */
export type BsGroupKind = "ASSET" | "LIABILITY" | "EQUITY";

export interface BalanceSheetRow {
  accountId: string;
  accountCode: string;
  accountName: string | null;
  isActive?: boolean;
  groupKind: BsGroupKind;
  /** AccountGroup label (Bangla-safe). */
  groupLabel: string;
  amount: string; // signed Decimal(18,4) — positive under the group's natural side
}

export interface BalanceSheetTotals {
  assets: string;
  liabilities: string;
  equity: string;
}
