/**
 * Sales / IPC (Interim Payment Certificate) view-model types (API contract 10 § "IPC
 * (SalesInvoice)"). Money is `Decimal(18,4)` JSON strings; dates `YYYY-MM-DD`; timestamps
 * ISO-8601 UTC. An IPC is a customer-side billing VOUCHER on the locked draft → posted →
 * cancelled lifecycle (CLAUDE.md): create/edit write NO ledger; posting allocates the gapless
 * Mushak number and writes the balanced entry via LED's `PostingService` (the UI never asserts
 * balance). `currentlyDueAmount` is server-derived (`certified + outputVat − retention −
 * advance − aitTds`, ≥ 0); `outstandingAmount`/`retentionHeldAmount` are derived read-only
 * queries. Shared with `fe-ipc-viewer` + `fe-ipc-register-retention`.
 */

export type IpcStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** One entry in the cancel/repost chain (FR-SAL-022), derived read-only from the ledger. */
export interface IpcLinkageEntry {
  entryId: string;
  entryNo: string;
  isReversal: boolean;
  isReversed: boolean;
  isCurrent: boolean;
  reversalOfEntryNo: string | null;
  reversedByEntryNo: string | null;
  postedAt: string;
}

export interface IpcLinkage {
  hasHistory: boolean;
  currentEntryNo: string | null;
  originalEntryNo: string | null;
  entries: IpcLinkageEntry[];
}

/** The full IPC resource (API contract 10 read shape). */
export interface Ipc {
  id: string;
  projectId: string;
  customerId: string;
  ipcSeqNo: number;
  ipcDate: string; // YYYY-MM-DD
  billDate: string;
  dueDate: string;
  workCompletedPct: string; // Decimal(18,4) 0–100
  certifiedAmount: string;
  costCentreId: string;
  purposeId: string;
  outputVatAmount: string;
  aitTdsAmount: string;
  retentionAmount: string;
  advanceRecoveredAmount: string;
  currentlyDueAmount: string; // derived, ≥ 0
  retentionRatePct: string;
  advanceRatePct: string;
  narration: string | null;
  status: IpcStatus;
  entryNo: string | null; // null while DRAFT
  journalEntryId: string | null;
  outstandingAmount: string; // derived (currentlyDue − receipts)
  retentionHeldAmount: string; // derived (retention − released)
  postedAt: string | null;
  postedBy: string | null;
  version: number;
  linkage?: IpcLinkage | null;
}

/** A row of the IPC list (API contract 10 § list — the summary projection). */
export interface IpcSummary {
  id: string;
  ipcSeqNo: number;
  entryNo: string | null;
  projectId: string;
  customerId: string;
  ipcDate: string;
  certifiedAmount: string;
  currentlyDueAmount: string;
  outstandingAmount: string;
  retentionHeldAmount: string;
  advanceRecoveredAmount: string;
  status: IpcStatus;
}

export interface IpcPage {
  data: IpcSummary[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Read-only picker options (MAS/AUD lookups; company implicit from the JWT). A project carries
 * its resolved customer + remaining mobilization advance so the editor can preview them the
 * moment a project is chosen (the server stays authoritative — it re-resolves + re-caps).
 */
export interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
  status?: string; // OPEN | ACTIVE | CLOSED — CLOSED excluded from the picker
  customerId: string;
  customerName: string;
  /** Remaining mobilization advance available to recover (Decimal(18,4)); "0.0000" when none left. */
  remainingAdvance: string;
  /** Whether the project ever carried a mobilization advance (distinguishes "fully recovered" from "none"). */
  hasMobilizationAdvance: boolean;
}
export interface CustomerOption {
  id: string;
  name: string;
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
