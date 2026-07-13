import { apiClient } from "@/lib/api";

/**
 * PUR-local view of the INV stock-ledger balance endpoint (API contract 07 §
 * `GET /api/stock-journal/stock-ledger`; FR-INV-001/021). The GRN entry's on-hand
 * badge reads this endpoint per (godown, item). Kept as its own binding here so
 * `features/purchase` doesn't cross the import boundary into `features/inventory`
 * (nextjs-author skill §2.4) — the endpoint is a shared read that both features
 * bind independently. Informational only, never a validation gate (spec §9).
 */

export interface StockBalance {
  godownId: string;
  itemId: string;
  quantityOnHand: string;
  totalValue: string;
  weightedAverageRate: string | null;
  asOfDate: string;
}

const BASE = "/stock-journal/stock-ledger";

export async function getStockBalance(godownId: string, itemId: string): Promise<StockBalance | null> {
  const p = new URLSearchParams({ godownId, itemId, page: "1", pageSize: "1" });
  const res = await apiClient.get<{ data: StockBalance[] }>(`${BASE}?${p.toString()}`);
  return res.data[0] ?? null;
}
