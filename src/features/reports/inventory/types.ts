/**
 * FE-58 fe-inventory-reports — per-report row shapes (FR-RPT-021/022/023,
 * contract 15 § "Inventory reports"). Reuses FE-54's `ReportResult<Row>`.
 */

export type InventoryReportTab = "STOCK_VALUATION" | "LOW_STOCK" | "TRANSFER_SUMMARY";

/** Map tab → REST endpoint slug. */
export const REPORT_NAME: Record<InventoryReportTab, string> = {
  STOCK_VALUATION: "stock-valuation",
  LOW_STOCK: "low-stock",
  TRANSFER_SUMMARY: "stock-transfer-summary",
};

export interface StockValuationRow {
  godownId: string;
  godownCode: string | null;
  godownName: string | null;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  quantityOnHand: string;
  totalValue: string;
  /** Null when the row has zero quantity (no movements yet). */
  weightedAverageRate: string | null;
  asOf: string;
  /** True when the historical item/godown is deactivated (SRS edge 14). */
  itemInactive?: boolean;
  godownInactive?: boolean;
}

export interface LowStockRow extends StockValuationRow {
  reorderLevel: string;
}

export type TransferMode = "TRANSFER" | "ISSUE";

export interface StockTransferRow {
  stockJournalId: string;
  voucherNo: string;
  voucherDate: string;
  fromGodownId: string | null;
  fromGodownName: string | null;
  toGodownId: string | null;
  toGodownName: string | null;
  itemId: string;
  itemName: string | null;
  quantity: string;
  value: string;
  mode: TransferMode;
  approverId: string | null;
  approverName: string | null;
}

export interface StockValuationTotals {
  totalValue: string;
}

export interface LowStockTotals {
  totalValue: string;
  breachedCount: number | string;
}

export interface StockTransferTotals {
  totalValueMoved: string;
}
