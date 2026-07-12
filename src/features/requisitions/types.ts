/**
 * Material Requisition view-model types (API contract 09). Money & quantity are
 * `Decimal(18,4)` JSON strings; dates `YYYY-MM-DD`. A requisition is a WORKFLOW document
 * (DRAFT → SUBMITTED → APPROVED/REJECTED → PARTIALLY_ISSUED → ISSUED/CLOSED) — entry/submit
 * write NO ledger line (SRS §4/§6). `indicativeRate`/`estimatedValue` are server-derived
 * (INV weighted-average), never client-sent. Shared with fe-requisition-approval / -issue.
 */

export type RequisitionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_ISSUED"
  | "ISSUED"
  | "CLOSED";

export type RequisitionPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ApprovalTier = "PM" | "ACCOUNTS";

/** One material line. `issued`/`balance`/`indicativeRate`/`uom` are read-only server fields. */
export interface RequisitionLine {
  id?: string;
  lineNo?: number;
  itemId: string;
  requestedQuantity: string;
  issuedQuantity?: string;
  balanceQuantity?: string;
  indicativeRate?: string | null;
  uom?: string;
}

export interface Requisition {
  id: string;
  requisitionNo: string | null;
  projectId: string;
  costCentreId: string;
  purposeId: string;
  fromGodownId: string | null;
  requiredDate: string; // YYYY-MM-DD
  priority: RequisitionPriority;
  status: RequisitionStatus;
  estimatedValue: string | null;
  approvalTier: ApprovalTier | null;
  submittedAt: string | null;
  submittedById: string | null;
  closedAt: string | null;
  closedReason: string | null;
  narration: string | null;
  lines?: RequisitionLine[];
  version: number;
}

export interface RequisitionPage {
  data: Requisition[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * One approval-history row (API contract 09 `GET /:id/approvals`; FR-REQ-008). Records a
 * single approve/reject decision with the tier + threshold it was evaluated against.
 * `reason` carries the reject reason (or an optional approve note). Shared with -issue's trail.
 */
export interface RequisitionApproval {
  id: string;
  decision: "APPROVED" | "REJECTED";
  tier: ApprovalTier;
  thresholdEvaluated: string | null;
  estimatedValueAtReview: string | null;
  reason: string | null;
  decidedById: string;
  decidedAt: string; // ISO-8601 UTC
}

/** CC advisory budget check result (FR-CC-014) — never blocks submit. */
export type BudgetStatus = "OK" | "APPROACHING" | "OVER";

/**
 * One line of a posted issue result (API contract 09 `POST /:id/issue`; FR-REQ-013/-014).
 * `rate`/`value` are the **server-computed** weighted-average at the moment of issue — never
 * client-sent. `stockMovementId` drills into the INV movement history.
 */
export interface RequisitionIssueLineResult {
  requisitionLineId: string;
  stockMovementId: string;
  issuedQuantity: string;
  rate: string;
  value: string;
}

/**
 * A posted issue event (API contract 09 `POST /:id/issue` result + `GET /:id/issues`;
 * FR-REQ-013…-019). `entryNo` is the gapless `STOCK_JOURNAL` number of the consumption entry;
 * `issuedValue = Σ line.value` = the posted `Dr material expense / Cr inventory` amount.
 * `reversedAt`/`reversedById` are non-null once the issue has been reversed (append-only).
 */
export interface RequisitionIssue {
  requisitionId: string;
  requisitionIssueId: string;
  issueNo: number;
  journalEntryId: string;
  entryNo: string;
  issuedValue: string;
  fromGodownId: string;
  lines: RequisitionIssueLineResult[];
  requisitionStatus: RequisitionStatus;
  issuedAt: string; // ISO-8601 UTC
  reversedAt?: string | null;
  reversedById?: string | null;
}

/** One outstanding line (API contract 09 `GET /:id/outstanding`; FR-REQ-018/-021). */
export interface RequisitionOutstandingLine {
  requisitionLineId: string;
  itemId: string;
  requestedQuantity: string;
  issuedQuantity: string;
  balanceQuantity: string;
  uom: string;
}

/** The outstanding-balance projection (API contract 09 `GET /:id/outstanding`; FR-REQ-021). */
export interface RequisitionOutstanding {
  requisitionId: string;
  status: RequisitionStatus;
  lines: RequisitionOutstandingLine[];
  totalOutstandingValueIndicative: string;
}

/** The INV on-hand read behind a per-line stock badge (REQ-local; `weightedAverageRate` null at 0). */
export interface OnHand {
  godownId: string;
  itemId: string;
  quantityOnHand: string;
  weightedAverageRate: string | null;
}

/** Read-only picker options (MAS/AUD lookups; company implicit from the JWT). */
export interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
  status?: string; // OPEN | CLOSED — CLOSED excluded from the picker
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
export interface UserOption {
  id: string;
  name: string;
}
