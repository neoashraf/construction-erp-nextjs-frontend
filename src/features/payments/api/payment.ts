import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type OpenPayable,
  type PayableAppliedResult,
  type PayableType,
  type Payment,
  type PaymentMode,
  type PaymentPage,
  type PaymentStatus,
  type PaymentSummary,
} from "../types";

/**
 * Payment API bindings (API contract 13 § "Payment Voucher" + "Bill-wise allocation";
 * FR-PAY-001…-020). Authored by FE-45 (this file) and reused by FE-46/FE-47. The
 * lifecycle is server-authoritative — no debit/credit logic here. Post/cancel/repost
 * are included so the sibling editor/viewer can call them without forking this file.
 */

const BASE = "/payment";

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface PaymentListFilter {
  partyId?: string;
  paymentMode?: string; // csv of PaymentMode
  status?: string; // csv of PaymentStatus
  paymentAccountId?: string;
  payableType?: string;
  financialYearId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  entryNo?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(f: PaymentListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("partyId", f.partyId);
  set("paymentMode", f.paymentMode);
  set("status", f.status);
  set("paymentAccountId", f.paymentAccountId);
  set("payableType", f.payableType);
  set("financialYearId", f.financialYearId);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  set("entryNo", f.entryNo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listPayments(f: PaymentListFilter = {}): Promise<PaymentPage> {
  const res = await apiClient.get<{
    data: PaymentSummary[];
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

export async function getPayment(id: string): Promise<Payment> {
  const res = await apiClient.get<{ data: Payment }>(`${BASE}/${id}`);
  return res.data;
}

// ── Editor write surface (FE-46 uses; authored here for shared reuse) ────────────────

export interface PaymentAllocationInput {
  payableType: PayableType;
  payableId: string;
  amountAllocated: string;
}

export interface PaymentWriteInput {
  partyId: string;
  paymentDate: string; // YYYY-MM-DD
  paymentMode: PaymentMode;
  paymentAccountId: string;
  chequeTxnRef: string | null;
  bankChargesAmount: string;
  bankChargesProjectId: string | null;
  bankChargesCostCentreId: string | null;
  bankChargesPurposeId: string | null;
  paymentAmount: string;
  narration: string | null;
  allocations: PaymentAllocationInput[];
}

export async function createPayment(input: PaymentWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return res.data;
}

export async function updatePayment(
  id: string,
  input: PaymentWriteInput & { version: number },
): Promise<Payment> {
  const res = await apiClient.patch<{ data: Payment }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deletePayment(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`, csrf());
}

export interface PaymentPostResult {
  id: string;
  entryNo: string;
  journalEntryId: string;
  status: Extract<PaymentStatus, "POSTED">;
  paymentAmount: string;
  allocatedAmount: string;
}

export async function postPayment(id: string, version: number): Promise<PaymentPostResult> {
  const res = await apiClient.post<{ data: PaymentPostResult }>(
    `${BASE}/${id}/post`,
    { version },
    csrf(),
  );
  return res.data;
}

export interface PaymentCancelResult {
  id: string;
  status: Extract<PaymentStatus, "CANCELLED">;
  reversalEntryId: string;
  reversalEntryNo: string;
}

export async function cancelPayment(
  id: string,
  input: { reason: string; version: number },
): Promise<PaymentCancelResult> {
  const res = await apiClient.post<{ data: PaymentCancelResult }>(
    `${BASE}/${id}/cancel`,
    input,
    csrf(),
  );
  return res.data;
}

export interface PaymentRepostResult {
  id: string;
  status: Extract<PaymentStatus, "POSTED">;
  entryNo: string;
  reversalEntryNo: string;
  paymentAmount: string;
}

export async function repostPayment(
  id: string,
  input: PaymentWriteInput & { reason: string; version: number },
): Promise<PaymentRepostResult> {
  const res = await apiClient.post<{ data: PaymentRepostResult }>(
    `${BASE}/${id}/repost`,
    input,
    csrf(),
  );
  return res.data;
}

// ── Bill-wise allocation reads ───────────────────────────────────────────────────────

export interface OpenPayablesFilter {
  partyId?: string;
  payableType?: string; // csv of PayableType
  financialYearId?: string;
  page?: number;
  pageSize?: number;
}

export async function listOpenPayables(f: OpenPayablesFilter = {}): Promise<OpenPayable[]> {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("partyId", f.partyId);
  set("payableType", f.payableType);
  set("financialYearId", f.financialYearId);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? 100));
  const res = await apiClient.get<{ data: OpenPayable[] }>(`${BASE}/open-payables?${p.toString()}`);
  return res.data;
}

export async function getPayableApplied(
  payableType: PayableType,
  payableId: string,
): Promise<PayableAppliedResult> {
  const res = await apiClient.get<{ data: PayableAppliedResult }>(
    `${BASE}/payables/${payableType}/${payableId}/applied`,
  );
  return res.data;
}
