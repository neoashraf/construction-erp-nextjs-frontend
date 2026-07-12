import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Ipc, type IpcPage, type IpcSummary } from "../types";

/**
 * IPC (SalesInvoice) API bindings (API contract 10 § "IPC (SalesInvoice)"; FR-SAL-001…-014,
 * -021…-024). The IPC follows the locked draft → posted → cancelled voucher lifecycle:
 * create/edit write NO ledger; **post** allocates the gapless Mushak number and writes the
 * balanced entry via LED's `PostingService` (internal — there is no `POST /api/ledger`, and
 * the UI never sends debit/credit). `customerId` is resolved server-side from the project;
 * `currentlyDueAmount`/`outstandingAmount`/`retentionHeldAmount`/`entryNo` are server-derived
 * and never client-supplied. `companyId` is implicit from the JWT; PM readers are scoped to
 * assigned projects server-side. Shared with `fe-ipc-viewer` + `fe-ipc-register-retention`.
 */

const BASE = "/sales/ipc";

/** Double-submit CSRF token for every state-changing call (skill §4). */
function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface IpcListFilter {
  projectId?: string;
  customerId?: string;
  status?: string; // csv of DRAFT,POSTED,CANCELLED
  dateFrom?: string; // YYYY-MM-DD (ipcDate range)
  dateTo?: string;
  entryNo?: string;
  page?: number;
  pageSize?: number;
}

/** Create/patch payload — the mutable draft capture fields (contract 10 create/PATCH body). */
export interface IpcWriteInput {
  projectId: string;
  ipcSeqNo: number;
  ipcDate: string;
  billDate: string;
  dueDate: string;
  workCompletedPct: string;
  certifiedAmount: string;
  costCentreId: string;
  purposeId: string;
  outputVatAmount: string;
  aitTdsAmount: string;
  retentionAmount: string;
  advanceRecoveredAmount: string;
  narration: string | null;
}

function buildQuery(f: IpcListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("projectId", f.projectId);
  set("customerId", f.customerId);
  set("status", f.status);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  set("entryNo", f.entryNo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listIpcs(f: IpcListFilter = {}): Promise<IpcPage> {
  const res = await apiClient.get<{
    data: IpcSummary[];
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

export async function getIpc(id: string): Promise<Ipc> {
  const res = await apiClient.get<{ data: Ipc }>(`${BASE}/${id}`);
  return res.data;
}

/** Create a DRAFT IPC — no number, no ledger impact (FR-SAL-001). Returns the new id. */
export async function createIpc(input: IpcWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return res.data;
}

/** Edit a DRAFT IPC (FR-SAL-023). Posted/cancelled are immutable (`VOUCHER_POSTED_IMMUTABLE`). */
export async function updateIpc(id: string, input: IpcWriteInput & { version: number }): Promise<Ipc> {
  const res = await apiClient.patch<{ data: Ipc }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** Hard-delete a DRAFT IPC (FR-SAL-023). Posted/cancelled cannot be deleted. */
export async function deleteIpc(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`, csrf());
}

export interface IpcPostResult {
  id: string;
  entryNo: string;
  journalEntryId: string;
  status: "POSTED";
  currentlyDueAmount: string;
}

/**
 * Post the IPC — allocate the gapless Mushak number (NUM) + write the balanced journal entry
 * (LED `PostingService`) atomically (FR-SAL-009…-013). Server-confirmed; the UI never
 * optimistically flips the status.
 */
export async function postIpc(id: string, version: number): Promise<IpcPostResult> {
  const res = await apiClient.post<{ data: IpcPostResult }>(`${BASE}/${id}/post`, { version }, csrf());
  return res.data;
}

export interface IpcCancelResult {
  id: string;
  status: "CANCELLED";
  reversalEntryId: string;
  reversalEntryNo: string;
}

/**
 * Cancel a POSTED IPC — LED reverses its entry; the IPC retains its original number
 * (FR-SAL-021, FR-SAL-022). `reason` is mandatory.
 */
export async function cancelIpc(id: string, input: { reason: string; version: number }): Promise<IpcCancelResult> {
  const res = await apiClient.post<{ data: IpcCancelResult }>(`${BASE}/${id}/cancel`, input, csrf());
  return res.data;
}

export interface IpcRepostResult {
  id: string;
  status: "POSTED";
  entryNo: string;
  reversalEntryNo: string;
  currentlyDueAmount: string;
}

/**
 * Correct a POSTED IPC — reverse-and-repost in one transaction; each new entry takes its own
 * number, the original number is retained (FR-SAL-022). Body = the corrected fields + a reason.
 */
export async function repostIpc(
  id: string,
  input: IpcWriteInput & { reason: string; version: number },
): Promise<IpcRepostResult> {
  const res = await apiClient.post<{ data: IpcRepostResult }>(`${BASE}/${id}/repost`, input, csrf());
  return res.data;
}
