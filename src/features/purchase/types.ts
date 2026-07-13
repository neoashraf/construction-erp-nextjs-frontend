/**
 * Purchase (PUR) view-model types (API contract 08). Money is `Decimal(18,4)` JSON strings;
 * quantity `Decimal(18,3)` — always transported as strings, never as JS `number`. Dates
 * `YYYY-MM-DD` (ISO for timestamps). A Purchase Order is a **non-posting commitment**
 * document (FR-PUR-001/-002): it writes NO ledger line and draws NO gapless `PURCHASE`
 * number — it carries its own `poRefNo` and the lifecycle `DRAFT → APPROVED →
 * PARTIALLY_BILLED/PARTIALLY_RECEIVED → CLOSED` (+ `CANCELLED` from `DRAFT`/`APPROVED`).
 * Bill/GRN types are declared here as forward-facing stubs to keep the shared feature
 * folder self-contained; `fe-purchase-bills` + `fe-grn-matching` fill in their bindings.
 * `companyId` is implicit from the JWT; PM readers are scoped to assigned projects server-side.
 */

/** PO lifecycle (FR-PUR-002/-017). Six terminal + intermediate states. */
export type PurchaseOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "PARTIALLY_BILLED"
  | "PARTIALLY_RECEIVED"
  | "CLOSED"
  | "CANCELLED";

/** Purchase Bill lifecycle (FR-PUR-004/-008/-022). Three states — the standard voucher matrix. */
export type PurchaseBillStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** Advisory over-budget status per (project, cost_centre) — never blocks Save/Approve (FR-PUR-019). */
export type BudgetStatus = "OK" | "APPROACHING" | "OVER" | "UNBUDGETED";

/** PO→Bill→GRN per-line variance (FR-PUR-017). */
export type PurchaseMatchStatus = "MATCHED" | "OVER_RECEIVED" | "UNDER_RECEIVED" | "PENDING_RECEIPT";

/** One PO line — the four dimensions + derived quantities read-only (FR-PUR-001/-010/-017). */
export interface PurchaseOrderLine {
  lineNo?: number;
  itemId: string;
  orderedQty: string;
  rate: string;
  lineAmount?: string;
  godownId: string;
  costCentreId: string;
  purposeId: string;
  billedQty?: string;
  receivedQty?: string;
}

/** Full PO resource (contract 08 § "Purchase Order"). */
export interface PurchaseOrder {
  id: string;
  projectId: string;
  supplierId: string;
  poRefNo: string | null;
  poDate: string;
  expectedDeliveryDate: string | null;
  status: PurchaseOrderStatus;
  narration: string | null;
  lines: PurchaseOrderLine[];
  approvedBy: string | null;
  approvedAt: string | null;
  version: number;
}

/** One PO list summary row (contract 08 GET /orders response element). */
export interface PurchaseOrderSummary {
  id: string;
  poRefNo: string | null;
  projectId: string;
  supplierId: string;
  poDate: string;
  status: PurchaseOrderStatus;
}

/** Per-line advisory budget-warning entry — surfaced from `meta.budgetWarnings` (FR-PUR-019). */
export interface BudgetWarning {
  projectId: string;
  costCentreId: string;
  status: BudgetStatus;
}

export interface PurchaseOrderPage {
  data: PurchaseOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
}

// ── Master picker options (thin PUR-local views over MAS lookups). Same shape family as
// the requisition/IPC picker options, so PoPicker + line grid stay reusable.

export interface ProjectOption {
  id: string;
  name: string;
  projectCode?: string;
  status?: string; // OPEN | CLOSED — CLOSED excluded from the picker
}

export interface SupplierOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CostCentreOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface PurposeOption {
  id: string;
  name: string;
  projectId: string;
  isActive: boolean;
}

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

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  isActive: boolean;
}

// ── Purchase Bill (contract 08 § "Purchase Bill") ─────────────────────────────

/**
 * One bill line — stock XOR non-stock (FR-PUR-005). A stock line carries `itemId`
 * + `godownId` + `isStockLine: true`; a non-stock line carries `expenseAccountId`
 * + `isStockLine: false` and no godown. `lineAmount` / `receivedQty` / `matchStatus`
 * are derived server-side (FR-PUR-017).
 */
export interface PurchaseBillLine {
  lineNo?: number;
  itemId: string | null;
  expenseAccountId: string | null;
  isStockLine: boolean;
  billedQty: string;
  rate: string;
  lineAmount?: string;
  vatInputAmount: string;
  tdsAmount: string;
  aitAmount: string;
  godownId: string | null;
  costCentreId: string;
  purposeId: string;
  receivedQty?: string;
  matchStatus?: PurchaseMatchStatus;
}

/** Full Purchase Bill resource shape (contract 08 § "Purchase Bill"). */
export interface PurchaseBill {
  id: string;
  projectId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  supplierInvoiceRef: string | null;
  billDate: string;
  dueDate: string;
  grossAmount: string;
  vatInputAmount: string;
  tdsAmount: string;
  aitAmount: string;
  netPayableAmount: string;
  narration: string | null;
  status: PurchaseBillStatus;
  entryNo: string | null;
  journalEntryId: string | null;
  outstandingAmount: string;
  lines: PurchaseBillLine[];
  postedAt: string | null;
  postedBy: string | null;
  version: number;
}

/** One bill list summary row (contract 08 GET /bills response element). */
export interface PurchaseBillSummary {
  id: string;
  entryNo: string | null;
  projectId: string;
  supplierId: string;
  billDate: string;
  grossAmount: string;
  vatInputAmount: string;
  tdsAmount: string;
  aitAmount: string;
  netPayableAmount: string;
  outstandingAmount: string;
  status: PurchaseBillStatus;
}

export interface PurchaseBillPage {
  data: PurchaseBillSummary[];
  page: number;
  pageSize: number;
  total: number;
}

// ── GRN (contract 08 § "GRN") ─────────────────────────────────────────────────
//
// A Goods Receipt Note records goods physically received against a PO and/or Bill.
// GRN Post drives the INV `receiveIn` stock movement for the **received** quantity —
// it writes NO ledger line and draws NO `PURCHASE` number (SRS §16). Lifecycle
// `DRAFT → POSTED` (+ `CANCELLED`); a posted GRN is read-only. `receivedValue`
// (= `receivedQty × rate`) and `matchStatus` are derived server-side on Post.

/** GRN lifecycle (FR-PUR-015/-016/-024). */
export type GrnStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** One GRN line — item + received qty + the four dimensions (FR-PUR-015/-016). */
export interface GrnLine {
  lineNo?: number;
  itemId: string;
  orderedQty: string;
  billedQty: string;
  receivedQty: string;
  rate: string;
  receivedValue?: string;
  godownId: string;
  costCentreId: string;
  purposeId: string;
  matchStatus?: PurchaseMatchStatus;
}

/** Full GRN resource (contract 08 § "GRN"). */
export interface Grn {
  id: string;
  projectId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  purchaseBillId: string | null;
  grnRefNo: string | null;
  receiptDate: string;
  narration: string | null;
  status: GrnStatus;
  lines: GrnLine[];
  receivedBy: string | null;
  postedAt: string | null;
  version: number;
}

/** One GRN list summary row (contract 08 GET /grns response element). */
export interface GrnSummary {
  id: string;
  grnRefNo: string | null;
  projectId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  purchaseBillId: string | null;
  receiptDate: string;
  status: GrnStatus;
}

export interface GrnPage {
  data: GrnSummary[];
  page: number;
  pageSize: number;
  total: number;
}

// ── PO → Bill → GRN match ──────────────────────────────────────────────────────

/** One line of the read-only match view (contract 08 GET /orders/{id}/match). */
export interface MatchLine {
  lineNo: number;
  itemId: string;
  orderedQty: string;
  billedQty: string;
  receivedQty: string;
  openQty: string;
  matchStatus: PurchaseMatchStatus;
}

/** Read-only reconciliation payload (contract 08 GET /orders/{id}/match). */
export interface MatchView {
  poId: string;
  poRefNo: string | null;
  projectId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  lines: MatchLine[];
}
