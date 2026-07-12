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

/** CC advisory budget check result (FR-CC-014) — never blocks submit. */
export type BudgetStatus = "OK" | "APPROACHING" | "OVER";

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
