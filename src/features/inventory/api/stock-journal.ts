import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type StockJournal, type StockJournalPage, type StockJournalLine, type StockJournalMode } from "../types";

/** Double-submit CSRF token for every state-changing call (skill §4). */
function csrf() {
  return { csrfToken: readCsrfToken() };
}

/**
 * Stock Journal API bindings (API contract 07 § Stock Journal; FR-INV-007…-022). The
 * voucher follows draft→approved→posted→cancelled — posting is INTERNAL (LED writes the
 * entry + allocates the gapless number inside the `…/post` transaction). `rate`/`value`
 * are server-computed at post; a client-supplied rate is never sent. `companyId` implicit
 * from the JWT; the server scopes PM/Store Keeper to assigned projects (`403` otherwise).
 */

const BASE = "/stock-journal";

export interface StockJournalListFilter {
  status?: string; // csv DRAFT,APPROVED,POSTED,CANCELLED
  mode?: string; // csv TRANSFER,ISSUE,ADJUSTMENT
  projectId?: string;
  godownId?: string;
  itemId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** Create/patch payload — per-side dimensions travel in `lines[]` (§5.1 four-dim matrix). */
export interface StockJournalWriteInput {
  voucherDate: string;
  mode: StockJournalMode;
  itemId: string;
  quantity: string;
  issuedById?: string | null;
  receivedById?: string | null;
  narration?: string | null;
  lines: Array<Pick<StockJournalLine, "side" | "godownId" | "projectId" | "costCentreId" | "purposeId">>;
}

function buildQuery(f: StockJournalListFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("status", f.status);
  set("mode", f.mode);
  set("projectId", f.projectId);
  set("godownId", f.godownId);
  set("itemId", f.itemId);
  set("dateFrom", f.dateFrom);
  set("dateTo", f.dateTo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

export async function listStockJournals(f: StockJournalListFilter = {}): Promise<StockJournalPage> {
  const res = await apiClient.get<{
    data: StockJournal[];
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

export async function getStockJournal(id: string): Promise<StockJournal> {
  const res = await apiClient.get<{ data: StockJournal }>(`${BASE}/${id}`);
  return res.data;
}

export async function createStockJournal(input: StockJournalWriteInput): Promise<StockJournal> {
  const res = await apiClient.post<{ data: StockJournal }>(BASE, input, csrf());
  return res.data;
}

export async function updateStockJournal(
  id: string,
  input: StockJournalWriteInput & { version: number },
): Promise<StockJournal> {
  const res = await apiClient.patch<{ data: StockJournal }>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deleteStockJournal(id: string, version: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}?version=${version}`, csrf());
}

export async function approveStockJournal(id: string, version: number): Promise<StockJournal> {
  const res = await apiClient.post<{ data: StockJournal }>(`${BASE}/${id}/approve`, { version }, csrf());
  return res.data;
}

export interface PostStockJournalInput {
  version: number;
  allowNegativeStock?: boolean;
  negativeStockReason?: string;
}
export async function postStockJournal(id: string, input: PostStockJournalInput): Promise<StockJournal> {
  const res = await apiClient.post<{ data: StockJournal }>(`${BASE}/${id}/post`, input, csrf());
  return res.data;
}

export async function reverseStockJournal(id: string, reason: string, version: number): Promise<StockJournal> {
  const res = await apiClient.post<{ data: StockJournal }>(`${BASE}/${id}/reverse`, { reason, version }, csrf());
  return res.data;
}
