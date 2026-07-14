import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type BudgetWarning,
  type PurchaseOrder,
  type PurchaseOrderPage,
  type PurchaseOrderSummary,
} from "../types";

/**
 * Purchase Order API bindings (API contract 08 § "Purchase Order"; FR-PUR-001/-002/-019/-024).
 * A PO is a **non-posting commitment**: create/edit write NO ledger, draw NO gapless
 * `PURCHASE` number, and approve is the analogue of a "post" step (no ledger effect).
 * `lineAmount`, `billedQty`, `receivedQty`, `poRefNo`, `approvedBy`/`approvedAt`, and the
 * status are all server-derived and never client-supplied. `companyId` is implicit from
 * the JWT; PM readers are scoped to assigned projects server-side (`403` on out-of-scope).
 *
 * Shared with fe-purchase-bills + fe-grn-matching (the shared `PoPicker` reads from here).
 */

const BASE = "/purchase/orders";

/** Double-submit CSRF token for every state-changing call (nextjs-author skill §4). */
function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface PurchaseOrderListFilter {
  projectId?: string;
  supplierId?: string;
  status?: string; // csv of PurchaseOrderStatus values
  dateFrom?: string; // YYYY-MM-DD (on poDate)
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** One line in the create/PATCH body (contract 08 POST /orders body). */
export interface PurchaseOrderLineInput {
  itemId: string;
  orderedQty: string;
  rate: string;
  godownId: string;
  costCentreId: string;
  purposeId: string;
}

/** Create/patch payload — mutable DRAFT fields (contract 08 POST/PATCH /orders body). */
export interface PurchaseOrderWriteInput {
  projectId: string;
  supplierId: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  narration: string | null;
  lines: PurchaseOrderLineInput[];
}

function buildQuery(f: PurchaseOrderListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("projectId", f.projectId);
  set("supplierId", f.supplierId);
  set("status", f.status);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listPurchaseOrders(f: PurchaseOrderListFilter = {}): Promise<PurchaseOrderPage> {
  const res = await apiClient.get<{
    data: PurchaseOrderSummary[];
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

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const res = await apiClient.get<{ data: PurchaseOrder }>(`${BASE}/${id}`);
  return res.data;
}

/**
 * The write result carries the id + any advisory budget warnings the server returned in
 * `meta.budgetWarnings` (FR-PUR-019). Warnings are non-blocking — the caller displays them
 * on the offending lines but neither Save nor Approve gate on them.
 */
export interface PurchaseOrderWriteResult {
  id: string;
  warnings: BudgetWarning[];
}

/** Create a DRAFT PO — writes no ledger, allocates no PO number (FR-PUR-001). */
export async function createPurchaseOrder(input: PurchaseOrderWriteInput): Promise<PurchaseOrderWriteResult> {
  const res = await apiClient.post<{
    data: { id: string };
    meta?: { budgetWarnings?: BudgetWarning[] };
  }>(BASE, input, csrf());
  return { id: res.data.id, warnings: res.meta?.budgetWarnings ?? [] };
}

/**
 * Edit a DRAFT PO (FR-PUR-024). `version` required for optimistic concurrency; APPROVED/
 * CLOSED/CANCELLED reject with `409 INVALID_PO_TRANSITION`. Returns the updated PO + any
 * advisory warnings from the fresh check.
 */
export interface PurchaseOrderUpdateResult {
  order: PurchaseOrder;
  warnings: BudgetWarning[];
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderWriteInput & { version: number },
): Promise<PurchaseOrderUpdateResult> {
  const res = await apiClient.patch<{
    data: PurchaseOrder;
    meta?: { budgetWarnings?: BudgetWarning[] };
  }>(`${BASE}/${id}`, input, csrf());
  return { order: res.data, warnings: res.meta?.budgetWarnings ?? [] };
}

export interface PurchaseOrderApproveResult {
  id: string;
  status: "APPROVED";
  approvedBy: string;
  approvedAt: string;
}

/**
 * Approve a DRAFT PO — `DRAFT → APPROVED`, server-confirmed (no optimistic flip). No ledger
 * effect, no gapless number (FR-PUR-002). Header/line fields become read-only after this.
 */
export async function approvePurchaseOrder(id: string, version: number): Promise<PurchaseOrderApproveResult> {
  const res = await apiClient.post<{ data: PurchaseOrderApproveResult }>(
    `${BASE}/${id}/approve`,
    { version },
    csrf(),
  );
  return res.data;
}

/**
 * Cancel a `DRAFT`/`APPROVED` PO with a mandatory reason (FR-PUR-002). A PO that already has
 * a Purchase Bill raised against it rejects with `409 PO_HAS_BILLS`; a stale/terminal
 * transition with `409 INVALID_PO_TRANSITION`.
 */
export interface PurchaseOrderCancelResult {
  id: string;
  status: "CANCELLED";
}

export async function cancelPurchaseOrder(
  id: string,
  input: { reason: string; version: number },
): Promise<PurchaseOrderCancelResult> {
  const res = await apiClient.post<{ data: PurchaseOrderCancelResult }>(
    `${BASE}/${id}/cancel`,
    input,
    csrf(),
  );
  return res.data;
}
