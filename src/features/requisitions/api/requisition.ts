import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type BudgetStatus,
  type Requisition,
  type RequisitionApproval,
  type RequisitionPage,
  type RequisitionPriority,
} from "../types";

/** Double-submit CSRF token for every state-changing call (skill §4). */
function csrf() {
  return { csrfToken: readCsrfToken() };
}

/**
 * Requisition API bindings (API contract 09 § Requisition; FR-REQ-001…-009/-021/-022).
 * A requisition is a workflow document — create/edit/submit write NO ledger (the ledger is
 * only touched at issue, a separate brief). `requisitionNo`/`estimatedValue`/`approvalTier`
 * are allocated/computed server-side at submit; `indicativeRate` is INV's weighted-average
 * (read from the stock-ledger projection). `companyId` implicit from the JWT; the server
 * scopes PM/Site Engineer to assigned projects (`403` otherwise).
 */

const BASE = "/requisition";

export interface RequisitionListFilter {
  status?: string; // csv
  priority?: string; // csv
  projectId?: string;
  costCentreId?: string;
  submittedById?: string;
  requiredFrom?: string;
  requiredTo?: string;
  hasOutstanding?: boolean;
  page?: number;
  pageSize?: number;
}

/** Create/patch payload — lines carry only itemId + requestedQuantity (rate is server-side). */
export interface RequisitionWriteInput {
  projectId: string;
  costCentreId: string;
  purposeId: string;
  fromGodownId: string | null;
  requiredDate: string;
  priority: RequisitionPriority;
  narration: string | null;
  lines: Array<{ itemId: string; requestedQuantity: string }>;
}

function buildQuery(f: RequisitionListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("status", f.status);
  set("priority", f.priority);
  set("projectId", f.projectId);
  set("costCentreId", f.costCentreId);
  set("submittedById", f.submittedById);
  set("requiredFrom", f.requiredFrom);
  set("requiredTo", f.requiredTo);
  if (f.hasOutstanding) p.set("hasOutstanding", "true");
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listRequisitions(f: RequisitionListFilter = {}): Promise<RequisitionPage> {
  const res = await apiClient.get<{
    data: Requisition[];
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

export async function getRequisition(id: string): Promise<Requisition> {
  const res = await apiClient.get<{ data: Requisition }>(`${BASE}/${id}`);
  return res.data;
}

export async function createRequisition(input: RequisitionWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<{ data: { id: string } }>(BASE, input, csrf());
  return res.data;
}

export async function updateRequisition(
  id: string,
  input: RequisitionWriteInput & { version: number },
): Promise<Requisition> {
  const res = await apiClient.patch<{ data: Requisition }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deleteRequisition(id: string, version: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}?version=${version}`, csrf());
}

export async function submitRequisition(id: string, version: number): Promise<Requisition> {
  const res = await apiClient.post<{ data: Requisition }>(`${BASE}/${id}/submit`, { version }, csrf());
  return res.data;
}

/**
 * Approve a SUBMITTED requisition (API contract 09 `POST /:id/approve`; FR-REQ-008). Pure
 * workflow — writes NO ledger line, moves NO stock (SRS §4/§6). `note` is optional context
 * recorded with the `RequisitionApproval`. Server-confirmed (no optimistic flip); the tier +
 * project-scope authority are re-validated server-side (`APPROVAL_BEYOND_AUTHORITY`).
 */
export async function approveRequisition(
  id: string,
  input: { note?: string | null; version: number },
): Promise<Requisition> {
  const res = await apiClient.post<{ data: Requisition }>(
    `${BASE}/${id}/approve`,
    { note: input.note ?? undefined, version: input.version },
    csrf(),
  );
  return res.data;
}

/**
 * Reject a SUBMITTED requisition with a mandatory non-empty reason (API contract 09
 * `POST /:id/reject`; FR-REQ-008). Returns it to the requester (`REJECTED`). Posts nothing.
 */
export async function rejectRequisition(
  id: string,
  input: { reason: string; version: number },
): Promise<Requisition> {
  const res = await apiClient.post<{ data: Requisition }>(
    `${BASE}/${id}/reject`,
    { reason: input.reason, version: input.version },
    csrf(),
  );
  return res.data;
}

/** The approval history for a requisition (API contract 09 `GET /:id/approvals`; FR-REQ-008). */
export async function listRequisitionApprovals(id: string): Promise<RequisitionApproval[]> {
  const res = await apiClient.get<{ data: RequisitionApproval[] }>(`${BASE}/${id}/approvals`);
  return res.data;
}

/**
 * The INV weighted-average rate for a `(godown, item)` (FR-REQ-005) — the requisition's
 * indicative rate. Read directly from the stock-ledger projection (REQ owns this thin
 * binding rather than importing `features/inventory`, per the import boundary). Without a
 * godown it falls back to the item's last-known rate across godowns. Returns `null` when
 * nothing is on hand anywhere (the line then shows "—").
 */
export async function getIndicativeRate(itemId: string, godownId?: string | null): Promise<string | null> {
  const p = new URLSearchParams({ itemId, page: "1", pageSize: "1" });
  if (godownId) p.set("godownId", godownId);
  const res = await apiClient.get<{ data: Array<{ weightedAverageRate: string | null }> }>(
    `/stock-journal/stock-ledger?${p.toString()}`,
  );
  return res.data[0]?.weightedAverageRate ?? null;
}

/**
 * The CC advisory over-budget check for a prospective requisition (FR-CC-014). Advisory
 * ONLY — the caller never blocks Save/Submit on the result. A check failure degrades to
 * `OK` (no false alarm) rather than surfacing an error.
 */
export async function checkBudget(input: {
  projectId: string;
  costCentreId: string;
  estimatedValue: string;
}): Promise<BudgetStatus> {
  try {
    const res = await apiClient.post<{ data: { status: BudgetStatus } }>(
      "/cost-control/budget-check",
      input,
      csrf(),
    );
    return res.data.status;
  } catch {
    return "OK";
  }
}
