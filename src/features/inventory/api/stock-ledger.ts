import { apiClient } from "@/lib/api";
import { type StockLedgerRow } from "../types";

/**
 * Stock-ledger read binding (API contract 07 § `GET /api/stock-journal/stock-ledger`;
 * FR-INV-001/004/021). READ-ONLY projection of quantity-on-hand + weighted-average rate
 * per `(godown, item)`. Shared with fe-stock-ledger — here it powers the editor's on-hand
 * badge + the live rate estimate. `weightedAverageRate` is `null` when on-hand is 0.
 */

const BASE = "/stock-journal/stock-ledger";

/** The single `(godown, item)` balance behind the on-hand badge, or null when unknown. */
export async function getStockBalance(godownId: string, itemId: string): Promise<StockLedgerRow | null> {
  const p = new URLSearchParams({ godownId, itemId, page: "1", pageSize: "1" });
  const res = await apiClient.get<{ data: StockLedgerRow[] }>(`${BASE}?${p.toString()}`);
  return res.data[0] ?? null;
}
