import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Grn, type GrnPage, type GrnStatus, type GrnSummary } from "../types";

/**
 * GRN API bindings (API contract 08 § "GRN"; FR-PUR-015/-016/-017/-018/-024). A GRN
 * records goods physically received against a PO and/or Bill. Draft capture is
 * non-posting; **Post** atomically drives INV `receiveIn` per line for the received
 * quantity — it writes NO ledger line and draws NO `PURCHASE` number (SRS §16
 * "PO/GRN numbering — RESOLVED"). `grnRefNo`/`postedAt`/`receivedBy` are `null`
 * while `DRAFT`. `receivedValue` and `matchStatus` are always server-derived.
 * A posted GRN is read-only; the API exposes no cancel/repost (correction is via
 * the parent bill).
 */

const BASE = "/purchase/grns";

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface GrnListFilter {
  projectId?: string;
  supplierId?: string;
  status?: string; // csv of GrnStatus values
  purchaseOrderId?: string;
  purchaseBillId?: string;
  grnRefNo?: string;
  dateFrom?: string; // YYYY-MM-DD on receiptDate
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** One line of the create/PATCH body (contract 08 POST /grns body). */
export interface GrnLineInput {
  itemId: string;
  receivedQty: string;
  rate: string;
  godownId: string;
  costCentreId: string;
  purposeId: string;
}

/** Create/PATCH payload — mutable DRAFT fields (contract 08 POST/PATCH /grns body). */
export interface GrnWriteInput {
  projectId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  purchaseBillId: string | null;
  receiptDate: string;
  narration: string | null;
  lines: GrnLineInput[];
}

function buildQuery(f: GrnListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("projectId", f.projectId);
  set("supplierId", f.supplierId);
  set("status", f.status);
  set("purchaseOrderId", f.purchaseOrderId);
  set("purchaseBillId", f.purchaseBillId);
  set("grnRefNo", f.grnRefNo);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listGrns(f: GrnListFilter = {}): Promise<GrnPage> {
  const res = await apiClient.get<{
    data: GrnSummary[];
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

export async function getGrn(id: string): Promise<Grn> {
  const res = await apiClient.get<{ data: Grn }>(`${BASE}/${id}`);
  return res.data;
}

export interface GrnWriteResult {
  id: string;
}

/** Create a DRAFT GRN — no inventory movement, no gapless number, no ledger. */
export async function createGrn(input: GrnWriteInput): Promise<GrnWriteResult> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return { id: res.data.id };
}

export interface GrnUpdateResult {
  grn: Grn;
}

/**
 * Edit a DRAFT GRN (FR-PUR-024). `version` required for optimistic concurrency;
 * a `POSTED`/`CANCELLED` GRN rejects with `409 VOUCHER_POSTED_IMMUTABLE`.
 */
export async function updateGrn(
  id: string,
  input: GrnWriteInput & { version: number },
): Promise<GrnUpdateResult> {
  const res = await apiClient.patch<{ data: Grn }>(`${BASE}/${id}`, input, csrf());
  return { grn: res.data };
}

export interface GrnPostResult {
  id: string;
  grnRefNo: string;
  status: "POSTED";
  postedAt: string;
}

/**
 * **Post** a DRAFT GRN (FR-PUR-016). Atomic: INV rolls each line's godown inventory
 * (`receiveIn`) for the received quantity. No ledger write, no `PURCHASE` number
 * (SRS §16 "PO/GRN numbering — RESOLVED"). Long-running by the platform's <2s NFR
 * budget but treated as a non-cancellable in-flight state by the FE.
 */
export async function postGrn(id: string, version: number): Promise<GrnPostResult> {
  const res = await apiClient.post<{ data: GrnPostResult }>(
    `${BASE}/${id}/post`,
    { version },
    csrf(),
  );
  return res.data;
}

/** Hard-delete a DRAFT GRN (204). POSTED/CANCELLED reject with 409. */
export async function deleteGrn(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE}/${id}`, csrf());
}

/** Guard: only DRAFT GRNs are editable (FR-PUR-024). */
export function isGrnEditable(status: GrnStatus): boolean {
  return status === "DRAFT";
}
