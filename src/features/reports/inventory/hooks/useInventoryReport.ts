"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { runReport } from "../../api/reports";
import { type ReportParams, type ReportResult } from "../../types";
import {
  REPORT_NAME,
  type InventoryReportTab,
  type LowStockRow,
  type LowStockTotals,
  type StockTransferRow,
  type StockTransferTotals,
  type StockValuationRow,
  type StockValuationTotals,
} from "../types";

export interface StockValuationResult extends ReportResult<StockValuationRow> {
  meta: ReportResult<StockValuationRow>["meta"] & { totals?: Partial<StockValuationTotals> };
}
export interface LowStockResult extends ReportResult<LowStockRow> {
  meta: ReportResult<LowStockRow>["meta"] & { totals?: Partial<LowStockTotals> };
}
export interface StockTransferResult extends ReportResult<StockTransferRow> {
  meta: ReportResult<StockTransferRow>["meta"] & { totals?: Partial<StockTransferTotals> };
}

export type AnyInventoryResult = StockValuationResult | LowStockResult | StockTransferResult;
type AnyRow = StockValuationRow | LowStockRow | StockTransferRow;

export function useInventoryReport(
  tab: InventoryReportTab,
  params: ReportParams | null,
  enabled: boolean,
) {
  const user = useAuthenticatedUser();
  return useQuery<AnyInventoryResult>({
    queryKey: queryKeys.detail(
      "reports",
      "inventory",
      `${user.companyId}:${user.financialYearId}:${REPORT_NAME[tab]}:${JSON.stringify(params ?? {})}`,
    ),
    queryFn: () =>
      runReport<AnyRow>(REPORT_NAME[tab], params!).then(
        (r) => r as unknown as AnyInventoryResult,
      ),
    enabled: !!params && enabled,
    retry: false,
    staleTime: 0,
  });
}

export function errorTitleFor(tab: InventoryReportTab): string {
  switch (tab) {
    case "STOCK_VALUATION": return "Couldn't load stock valuation.";
    case "LOW_STOCK": return "Couldn't load the low-stock report.";
    case "TRANSFER_SUMMARY": return "Couldn't load the transfer summary.";
  }
}
export function subtitleFor(tab: InventoryReportTab): string {
  switch (tab) {
    case "STOCK_VALUATION":
      return "Qty on hand · total value · weighted-avg rate per (godown, item), as-of a date.";
    case "LOW_STOCK":
      return "Items at or below their re-order level.";
    case "TRANSFER_SUMMARY":
      return "Posted stock-journal transfers/issues over a date range.";
  }
}
export function breadcrumbFor(tab: InventoryReportTab): string {
  switch (tab) {
    case "STOCK_VALUATION": return "Stock valuation";
    case "LOW_STOCK": return "Low-stock";
    case "TRANSFER_SUMMARY": return "Stock transfer summary";
  }
}
