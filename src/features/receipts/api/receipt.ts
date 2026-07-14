import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type PaymentMode,
  type Receipt,
  type ReceiptPage,
  type ReceiptStatus,
  type ReceiptSummary,
  type ReceiptType,
  type ReceiptsForIpc,
} from "../types";

/**
 * Receipt API bindings (API contract 11 § "Receipt (ReceiptVoucher)" / "Receipts
 * against an IPC"; FR-REC-001…-025). Extended by FE-43 (this file) with the editor's
 * write surface: create/get/patch/delete a DRAFT + post it. Cancel/repost are added by
 * FE-44 (viewer). The lifecycle is server-authoritative — no debit/credit logic here.
 */

function csrf() {
  return { csrfToken: readCsrfToken() };
}

const BASE = "/receipt";

export interface ReceiptListFilter {
  receiptType?: string; // IPC_LINKED | GENERAL
  projectId?: string;
  customerId?: string;
  ipcId?: string;
  paymentMode?: string; // csv of PaymentMode
  status?: string; // csv of ReceiptStatus
  financialYearId?: string;
  dateFrom?: string; // YYYY-MM-DD on receiptDate
  dateTo?: string;
  entryNo?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(f: ReceiptListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("receiptType", f.receiptType);
  set("projectId", f.projectId);
  set("customerId", f.customerId);
  set("ipcId", f.ipcId);
  set("paymentMode", f.paymentMode);
  set("status", f.status);
  set("financialYearId", f.financialYearId);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  set("entryNo", f.entryNo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listReceipts(f: ReceiptListFilter = {}): Promise<ReceiptPage> {
  const res = await apiClient.get<{
    data: ReceiptSummary[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(f)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? f.page ?? 1,
    pageSize: meta.pageSize ?? f.pageSize ?? DEFAULT_PAGE_SIZE,
    total: meta.total ?? res.data.length,
  };
}

/** The receipts applied to one IPC + its resulting balance due (FR-REC-016/-018). */
export async function getReceiptsForIpc(ipcId: string): Promise<ReceiptsForIpc> {
  const res = await apiClient.get<{ data: ReceiptsForIpc }>(`${BASE}/ipc/${ipcId}`);
  return res.data;
}

/** A DRAFT row (no legal number yet — FR-REC-013) routes to the editor, not the viewer. */
export function isReceiptDraft(status: ReceiptSummary["status"]): boolean {
  return status === "DRAFT";
}

// ── Editor write surface (FE-43) ─────────────────────────────────────────────────────

/**
 * Body of `POST /api/receipt` and `PATCH /api/receipt/{id}` — one payload discriminated
 * by `receiptType`. IPC-linked resolves `partyId`/`projectId`/`costCentreId`/`purposeId`
 * server-side from the referenced posted IPC (never supplied by the client); general
 * requires `generalTargetAccountId`, `costCentreId`, and (optional) `projectId`. Money
 * is `Decimal(18,4)` JSON strings; dates are `YYYY-MM-DD`. `chequeTxnRef` is required
 * for non-cash modes (server backstop `CHEQUE_REF_REQUIRED`).
 */
export interface IpcLinkedWriteInput {
  receiptType: "IPC_LINKED";
  receiptDate: string;
  paymentMode: PaymentMode;
  depositAccountId: string;
  ipcId: string;
  amountSettled: string;
  taxDeductedAtSource: string;
  chequeTxnRef: string | null;
  narration: string | null;
}
export interface GeneralWriteInput {
  receiptType: "GENERAL";
  receiptDate: string;
  paymentMode: PaymentMode;
  depositAccountId: string;
  partyId: string;
  generalTargetAccountId: string;
  projectId: string | null;
  costCentreId: string;
  purposeId: string | null;
  amountSettled: string;
  chequeTxnRef: string | null;
  narration: string | null;
}
export type ReceiptWriteInput = IpcLinkedWriteInput | GeneralWriteInput;

export async function getReceipt(id: string): Promise<Receipt> {
  const res = await apiClient.get<{ data: Receipt }>(`${BASE}/${id}`);
  return res.data;
}

/** Create a DRAFT receipt — no number, no ledger impact (FR-REC-001). */
export async function createReceipt(input: ReceiptWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return res.data;
}

/** Edit a DRAFT receipt (FR-REC-024). Posted/cancelled are immutable. */
export async function updateReceipt(
  id: string,
  input: ReceiptWriteInput & { version: number },
): Promise<Receipt> {
  const res = await apiClient.patch<{ data: Receipt }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** Hard-delete a DRAFT receipt (FR-REC-024). Posted/cancelled cannot be deleted. */
export async function deleteReceipt(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`, csrf());
}

export interface ReceiptPostResult {
  id: string;
  entryNo: string;
  journalEntryId: string;
  status: Extract<ReceiptStatus, "POSTED">;
  ipcOutstandingAfter: string | null;
}

/**
 * Post the receipt — allocate the gapless `RECEIPT` number and write the balanced
 * journal entry atomically (FR-REC-009…-014). Server-confirmed; the UI never
 * optimistically flips the status.
 */
export async function postReceipt(id: string, version: number): Promise<ReceiptPostResult> {
  const res = await apiClient.post<{ data: ReceiptPostResult }>(
    `${BASE}/${id}/post`,
    { version },
    csrf(),
  );
  return res.data;
}

/** A POSTED/CANCELLED id can never re-open in the editor — it routes to the viewer. */
export function isReceiptEditable(status: ReceiptType extends never ? never : ReceiptStatus): boolean {
  return status === "DRAFT";
}
