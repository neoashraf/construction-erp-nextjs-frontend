/**
 * View-model types for the Accounting Period Control (PER) feature (skill §2.1).
 * Mirrors the `AccountingPeriod` resource shape (API contract 04-period-control) —
 * these are the UI-facing types, not the generated wire types.
 */

export type PeriodStatus = "OPEN" | "CLOSED";

export interface AccountingPeriod {
  id: string;
  financialYearId: string;
  name: string;
  /** ISO `YYYY-MM-DD`. */
  startDate: string;
  /** ISO `YYYY-MM-DD`, inclusive. */
  endDate: string;
  status: PeriodStatus;
  /** ISO-8601 UTC; non-null only while `status = CLOSED`. */
  closedAt: string | null;
  /** The acting user's display name; non-null only while `status = CLOSED`. */
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `POST /api/periods/generate` response. */
export interface GeneratePeriodsResult {
  financialYearId: string;
  count: number;
  periods: AccountingPeriod[];
}

/** `POST /api/periods/close-fy` response. */
export interface CloseFyResult {
  financialYearId: string;
  closedCount: number;
  alreadyClosedCount: number;
  periods: AccountingPeriod[];
}

/** The financial years the in-page selector lists (MAS-owned; PER only references). */
export interface FinancialYearOption {
  id: string;
  label: string;
  /** ISO `YYYY-MM-DD`. */
  startDate: string;
  /** ISO `YYYY-MM-DD`. */
  endDate: string;
  isActive?: boolean;
}

/** The confirm-dialog kinds this screen opens (spec §6/§8/§9). */
export type PeriodDialog =
  | { kind: "generate"; financialYearId: string }
  | { kind: "close"; period: AccountingPeriod }
  | { kind: "reopen"; period: AccountingPeriod }
  | { kind: "close-fy"; financialYearId: string; openCount: number };
