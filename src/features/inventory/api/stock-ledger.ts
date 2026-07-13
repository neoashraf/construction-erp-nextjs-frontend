import { apiClient } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { type StockLedgerPage, type StockLedgerRow, type StockMovementPage } from "../types";

/**
 * Stock-ledger read bindings (API contract 07 § `GET /api/stock-journal/stock-ledger` +
 * `…/movements`; FR-INV-001/004/006/021). READ-ONLY projection — there is no write
 * endpoint here; balances change only by posting/reversing a stock-affecting voucher.
 * `getStockBalance` powers the Stock Journal editor's on-hand badge; `listStockLedger` +
 * `listStockMovements` power fe-stock-ledger. `weightedAverageRate` is `null` at zero on hand.
 */

const BASE = "/stock-journal/stock-ledger";

/** The single `(godown, item)` balance behind the on-hand badge, or null when unknown. */
export async function getStockBalance(godownId: string, itemId: string): Promise<StockLedgerRow | null> {
  const p = new URLSearchParams({ godownId, itemId, page: "1", pageSize: "1" });
  const res = await apiClient.get<{ data: StockLedgerRow[] }>(`${BASE}?${p.toString()}`);
  return res.data[0] ?? null;
}

export interface StockLedgerFilter {
  godownId?: string;
  itemId?: string;
  projectId?: string;
  asOfDate?: string; // YYYY-MM-DD; omitted = Latest (current balance)
  page?: number;
  pageSize?: number;
}

function ledgerQuery(f: StockLedgerFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("godownId", f.godownId);
  set("itemId", f.itemId);
  set("projectId", f.projectId);
  set("asOfDate", f.asOfDate);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? 200));
  return p.toString();
}

/** Balances per `(godown, item)`, current or as-of a date (FR-INV-001/021). */
export async function listStockLedger(f: StockLedgerFilter = {}): Promise<StockLedgerPage> {
  const res = await apiClient.get<{
    data: StockLedgerRow[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${ledgerQuery(f)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? f.page ?? 1,
    pageSize: meta.pageSize ?? f.pageSize ?? 200,
    total: meta.total ?? res.data.length,
  };
}

export interface StockMovementFilter {
  godownId: string; // required by the endpoint
  itemId: string; // required by the endpoint
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

function movementsQuery(f: StockMovementFilter): string {
  const p = new URLSearchParams({ godownId: f.godownId, itemId: f.itemId });
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo) p.set("dateTo", f.dateTo);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? DEFAULT_PAGE_SIZE));
  return p.toString();
}

/** The append-only movement history for one `(godown, item)` (FR-INV-004/006/021). */
export async function listStockMovements(f: StockMovementFilter): Promise<StockMovementPage> {
  const res = await apiClient.get<{
    data: StockMovementPage["data"];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}/movements?${movementsQuery(f)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? f.page ?? 1,
    pageSize: meta.pageSize ?? f.pageSize ?? DEFAULT_PAGE_SIZE,
    total: meta.total ?? res.data.length,
  };
}
