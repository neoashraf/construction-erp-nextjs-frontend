"use client";

import { Badge } from "@/components/ui/badge";
import { formatMoney, formatQty } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable, ddMmYyyy } from "./shared";
import { type LowStockRow, type LowStockTotals } from "../types";

/**
 * FE-58 Low-stock / re-order body (FR-RPT-022). Adds a Re-order level column
 * and flags below-threshold quantities via text + tone (WCAG 1.4.1). The
 * breached-row count comes from `meta.totals.breachedCount` — no client Σ.
 */
export function LowStockTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel = "No items are at or below the re-order level.",
}: {
  rows: LowStockRow[] | undefined;
  totals: LowStockTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel?: string;
}) {
  if (isLoading) return <LoadingBody testid="iv-ls-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load the low-stock report."
        onRetry={onRetry}
        testid="iv-ls-error"
        retryTestid="iv-ls-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="iv-ls-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="iv-ls-empty" />;

  const captionId = "iv-ls-caption";
  return (
    <div data-testid="iv-ls-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Godown</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Item</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Qty on hand</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Re-order level</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Total value</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Status</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">As-of</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.godownId}-${r.itemId}`}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="iv-ls-row"
              >
                <td className="px-4 py-2.5">
                  {r.godownName ? (
                    <span className="font-medium">
                      {r.godownCode}
                      <span className="mx-1 text-muted-foreground">·</span>
                      {r.godownName}
                    </span>
                  ) : (
                    <NameUnavailable id={r.godownCode ?? r.godownId} />
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {r.itemName ? (
                    <span className="font-medium">
                      {r.itemCode}
                      <span className="mx-1 text-muted-foreground">·</span>
                      {r.itemName}
                    </span>
                  ) : (
                    <NameUnavailable id={r.itemCode ?? r.itemId} />
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatQty(r.quantityOnHand)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatQty(r.reorderLevel)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(r.totalValue)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone="destructive" dot data-testid="iv-ls-below-badge">
                    Below re-order
                  </Badge>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{ddMmYyyy(r.asOf)}</td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-warning-soft text-[13px] font-bold text-warning-ink"
                data-testid="iv-ls-totals-footer"
              >
                <td colSpan={4} className="px-4 py-3">
                  {totals.breachedCount} items at or below re-order level
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.totalValue)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {generatedAt && (
        <div className="px-6 pb-4 pt-3">
          <ReportGeneratedAt generatedAt={generatedAt} id={captionId} />
        </div>
      )}
    </div>
  );
}
