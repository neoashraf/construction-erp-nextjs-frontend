import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type BudgetWarning,
  type PurchaseBill,
  type PurchaseBillPage,
  type PurchaseBillStatus,
  type PurchaseBillSummary,
} from "../types";

/**
 * Purchase Bill API bindings (API contract 08 § "Purchase Bill"; FR-PUR-003…-014,
 * -019…-024). Draft capture is non-posting; **posting** atomically rolls the receiving
 * godown's inventory, allocates the gapless `PURCHASE` number, and writes the balanced
 * journal entry via LED's internal `PostingService` — the FE never asserts Σdr=Σcr, it
 * only guards the postable-required fields client-side. `entryNo`/`journalEntryId`/
 * `postedAt`/`postedBy` are `null` while `DRAFT`. `lineAmount`, `grossAmount`, and
 * `netPayableAmount` are always server-derived (per-line `vatInputAmount`/`tdsAmount`/
 * `aitAmount` default to the configured rate when omitted, overridable — FR-PUR-006).
 * `outstandingAmount` and per-line `receivedQty`/`matchStatus` are derived read-only.
 */

const BASE = "/purchase/bills";

/** Double-submit CSRF token for every state-changing call (nextjs-author skill §4). */
function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface PurchaseBillListFilter {
  projectId?: string;
  supplierId?: string;
  status?: string; // csv of PurchaseBillStatus values
  purchaseOrderId?: string;
  financialYearId?: string;
  entryNo?: string;
  dateFrom?: string; // YYYY-MM-DD (on billDate)
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** One line in the create/PATCH body (contract 08 POST /bills body). */
export interface PurchaseBillLineInput {
  itemId: string | null;
  expenseAccountId: string | null;
  isStockLine: boolean;
  billedQty: string;
  rate: string;
  vatInputAmount: string;
  tdsAmount: string;
  aitAmount: string;
  godownId: string | null;
  costCentreId: string;
  purposeId: string;
}

/** Create/patch payload — mutable DRAFT fields (contract 08 POST/PATCH /bills body). */
export interface PurchaseBillWriteInput {
  projectId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  supplierInvoiceRef: string | null;
  billDate: string;
  dueDate: string;
  narration: string | null;
  lines: PurchaseBillLineInput[];
}

function buildQuery(f: PurchaseBillListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("projectId", f.projectId);
  set("supplierId", f.supplierId);
  set("status", f.status);
  set("purchaseOrderId", f.purchaseOrderId);
  set("financialYearId", f.financialYearId);
  set("entryNo", f.entryNo);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listPurchaseBills(f: PurchaseBillListFilter = {}): Promise<PurchaseBillPage> {
  const res = await apiClient.get<{
    data: PurchaseBillSummary[];
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

export async function getPurchaseBill(id: string): Promise<PurchaseBill> {
  const res = await apiClient.get<{ data: PurchaseBill }>(`${BASE}/${id}`);
  return res.data;
}

/**
 * The write result carries the id + any advisory budget warnings the server returned in
 * `meta.budgetWarnings` (FR-PUR-019). Warnings are non-blocking — the caller displays
 * them on the offending lines but neither Save nor Post gates on them.
 */
export interface PurchaseBillWriteResult {
  id: string;
  warnings: BudgetWarning[];
}

/** Create a DRAFT bill — writes no ledger, no gapless number, no inventory movement. */
export async function createPurchaseBill(input: PurchaseBillWriteInput): Promise<PurchaseBillWriteResult> {
  const res = await apiClient.post<{
    data: { id: string };
    meta?: { budgetWarnings?: BudgetWarning[] };
  }>(BASE, input, csrf());
  return { id: res.data.id, warnings: res.meta?.budgetWarnings ?? [] };
}

export interface PurchaseBillUpdateResult {
  bill: PurchaseBill;
  warnings: BudgetWarning[];
}

/**
 * Edit a DRAFT bill (FR-PUR-024). `version` required for optimistic concurrency;
 * `POSTED`/`CANCELLED` reject with `409 VOUCHER_POSTED_IMMUTABLE`.
 */
export async function updatePurchaseBill(
  id: string,
  input: PurchaseBillWriteInput & { version: number },
): Promise<PurchaseBillUpdateResult> {
  const res = await apiClient.patch<{
    data: PurchaseBill;
    meta?: { budgetWarnings?: BudgetWarning[] };
  }>(`${BASE}/${id}`, input, csrf());
  return { bill: res.data, warnings: res.meta?.budgetWarnings ?? [] };
}

/** Hard-delete a DRAFT bill (204). Posted/cancelled reject with 409. */
export async function deletePurchaseBill(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE}/${id}`, csrf());
}

export interface PurchaseBillPostResult {
  id: string;
  entryNo: string;
  journalEntryId: string;
  status: "POSTED";
  netPayableAmount: string;
}

/**
 * **Post** a DRAFT bill (FR-PUR-008…-014). Atomic: LED writes the balanced entry,
 * INV rolls the receiving godowns' inventory (`receiveIn`), NUM allocates the gapless
 * `PURCHASE` number, all in one transaction. Long-running by the platform's
 * <2s NFR budget but treated as a non-cancellable in-flight state by the FE.
 */
export async function postPurchaseBill(id: string, version: number): Promise<PurchaseBillPostResult> {
  const res = await apiClient.post<{ data: PurchaseBillPostResult }>(
    `${BASE}/${id}/post`,
    { version },
    csrf(),
  );
  return res.data;
}

export interface PurchaseBillCancelResult {
  id: string;
  status: "CANCELLED";
  reversalEntryId: string;
  reversalEntryNo: string;
}

/**
 * **Cancel** a POSTED bill — LED reverses the journal entry AND INV reverses the
 * receipt-in movement; the bill moves `POSTED → CANCELLED` and retains its original
 * `entryNo` (FR-PUR-022, FR-PUR-023). A `409 BILL_HAS_APPLIED_PAYMENTS` blocks the
 * cancel until payments are reversed/reallocated (SRS §16 / edge case 12).
 */
export async function cancelPurchaseBill(
  id: string,
  input: { reason: string; version: number },
): Promise<PurchaseBillCancelResult> {
  const res = await apiClient.post<{ data: PurchaseBillCancelResult }>(
    `${BASE}/${id}/cancel`,
    input,
    csrf(),
  );
  return res.data;
}

export interface PurchaseBillRepostResult {
  id: string;
  status: "POSTED";
  entryNo: string;
  reversalEntryNo: string;
  netPayableAmount: string;
}

/**
 * **Repost / correct** a POSTED bill (FR-PUR-022, FR-PUR-023; FR-LED-027). LED
 * reverses the original entry and posts a corrected one, INV mirrors, all in one
 * transaction. Both new entries take their own numbers; the original number is
 * retained on the reversed bill.
 */
export async function repostPurchaseBill(
  id: string,
  input: PurchaseBillWriteInput & { reason: string; version: number },
): Promise<PurchaseBillRepostResult> {
  const res = await apiClient.post<{ data: PurchaseBillRepostResult }>(
    `${BASE}/${id}/repost`,
    input,
    csrf(),
  );
  return res.data;
}

/** Guard: only DRAFT bills are editable on this screen (FR-PUR-024). */
export function isBillEditable(status: PurchaseBillStatus): boolean {
  return status === "DRAFT";
}
