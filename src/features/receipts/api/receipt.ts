import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type ReceiptPage, type ReceiptSummary, type ReceiptsForIpc } from "../types";

/**
 * Receipt API bindings (API contract 11 § "Receipt (ReceiptVoucher)" / "Receipts
 * against an IPC"; FR-REC-016/-018/-025). This brief binds the two READ surfaces the
 * list needs — `GET /api/receipt` (paginated, filtered) and `GET /api/receipt/ipc/{ipcId}`
 * (the IPC deep-link context). `fe-receipt-editor` (FE-43) and `fe-receipt-viewer`
 * (FE-44) extend this file with create/patch/delete/post/cancel/repost/get-by-id —
 * do not add write bindings here (this list mutates nothing).
 */

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
