/**
 * Inventory (Stock Journal) view-model types (API contract 07). Money & quantity are
 * `Decimal(18,4)` JSON strings (`"26000.0000"`); dates `YYYY-MM-DD`. `rate`/`value` are
 * server-computed at post (never client-sent). The Stock Journal follows the locked
 * draft→approved→posted→cancelled voucher lifecycle (CLAUDE.md).
 */

export type StockJournalMode = "TRANSFER" | "ISSUE" | "ADJUSTMENT";
export type StockJournalStatus = "DRAFT" | "APPROVED" | "POSTED" | "CANCELLED";
export type StockJournalSide = "OUT" | "IN";

/** One OUT/IN side of a journal, carrying its own four posting dimensions (§5.1 matrix). */
export interface StockJournalLine {
  lineNo?: number;
  side: StockJournalSide;
  godownId: string;
  itemId: string;
  quantity: string;
  rate?: string | null;
  value?: string | null;
  projectId: string;
  costCentreId: string;
  purposeId: string;
}

export interface StockJournal {
  id: string;
  entryNo: string | null;
  voucherDate: string; // YYYY-MM-DD
  mode: StockJournalMode;
  status: StockJournalStatus;
  fromGodownId: string | null;
  toGodownId: string | null;
  itemId: string;
  quantity: string;
  rate: string | null;
  value: string | null;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  issuedById: string | null;
  receivedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  negativeStockAuthorisedById: string | null;
  negativeStockReason: string | null;
  journalEntryId: string | null;
  narration: string | null;
  postedAt: string | null;
  postedById: string | null;
  version: number;
  lines?: StockJournalLine[];
}

export interface StockJournalPage {
  data: StockJournal[];
  page: number;
  pageSize: number;
  total: number;
}

/** Stock-ledger balance projection (shared with fe-stock-ledger) — powers the on-hand badge. */
export interface StockLedgerRow {
  godownId: string;
  itemId: string;
  quantityOnHand: string;
  totalValue: string;
  weightedAverageRate: string | null;
  asOfDate: string;
}

export interface StockLedgerPage {
  data: StockLedgerRow[];
  page: number;
  pageSize: number;
  total: number;
}

export type StockMovementDirection = "IN" | "OUT";
export type StockMovementSourceType = "STOCK_JOURNAL" | "GRN" | "REQ_ISSUE";

/**
 * One append-only movement behind a `(godown, item)` balance (API contract 07 §
 * `GET …/stock-ledger/movements`; FR-INV-004/006/021). `balance*After`/`avgRateAfter` are
 * the running snapshot right after this movement; a reversal is an additive mirror row
 * (`isReversal`), never an edit of the original (FR-INV-020).
 */
export interface StockMovement {
  id: string;
  godownId: string;
  itemId: string;
  sourceType: StockMovementSourceType;
  sourceId: string | null;
  direction: StockMovementDirection;
  quantity: string;
  rate: string;
  value: string;
  balanceQtyAfter: string;
  balanceValueAfter: string;
  avgRateAfter: string;
  isReversal: boolean;
  reversalOf: string | null;
  voucherDate: string; // YYYY-MM-DD
  postedAt: string; // ISO-8601 UTC
}

export interface StockMovementPage {
  data: StockMovement[];
  page: number;
  pageSize: number;
  total: number;
}

/** Read-only picker options (MAS/AUD lookups; company implicit from the JWT). */
export interface GodownOption {
  id: string;
  code: string;
  name: string;
  projectId: string;
  isActive: boolean;
}
export interface ItemOption {
  id: string;
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
}
export interface PurposeOption {
  id: string;
  name: string;
  projectId: string;
  isActive: boolean;
}
export interface UserOption {
  id: string;
  name: string;
}
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
