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
