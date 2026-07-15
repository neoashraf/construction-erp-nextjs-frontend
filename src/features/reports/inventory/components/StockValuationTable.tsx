"use client";

import { formatMoney, formatQty } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, InactiveTag, LoadingBody, NameUnavailable, ddMmYyyy } from "./shared";
import { type StockValuationRow, type StockValuationTotals } from "../types";

/**
 * FE-58 Stock valuation body (FR-RPT-021). Rows are as-of a date; a zero-stock
 * row renders as a valid `৳0` line with a per-row note (SRS edge 11) — never
 * confused with the empty-state. Total footer is rendered from
 * `meta.totals.totalValue` (backend reconciles to INV control — no client Σ).
 */
export function StockValuationTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel = "No results for these filters.",
}: {
  rows: StockValuationRow[] | undefined;
  totals: StockValuationTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel?: string;
}) {
  if (isLoading) return <LoadingBody testid="iv-sv-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load stock valuation."
        onRetry={onRetry}
        testid="iv-sv-error"
        retryTestid="iv-sv-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="iv-sv-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="iv-sv-empty" />;

  const captionId = "iv-sv-caption";
  return (
    <div data-testid="iv-sv-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Godown</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Item</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Qty on hand</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Total value</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Weighted-avg rate</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">As-of</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const zero = Number(r.quantityOnHand) === 0;
              return (
                <tr
                  key={`${r.godownId}-${r.itemId}`}
                  className="border-b border-border/60 hover:bg-canvas/60"
                  data-testid={zero ? "iv-sv-zero-row" : "iv-sv-row"}
                >
                  <td className="px-4 py-2.5">
                    {r.godownName ? (
                      <>
                        <span className="font-medium">
                          {r.godownCode}
                          <span className="mx-1 text-muted-foreground">·</span>
                          {r.godownName}
                        </span>
                        {r.godownInactive && <InactiveTag />}
                      </>
                    ) : (
                      <NameUnavailable id={r.godownCode ?? r.godownId} />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.itemName ? (
                      <>
                        <span className="font-medium">
                          {r.itemCode}
                          <span className="mx-1 text-muted-foreground">·</span>
                          {r.itemName}
                        </span>
                        {r.itemInactive && <InactiveTag />}
                      </>
                    ) : (
                      <NameUnavailable id={r.itemCode ?? r.itemId} />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatQty(r.quantityOnHand)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatMoney(r.totalValue)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.weightedAverageRate !== null ? formatMoney(r.weightedAverageRate) : "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{ddMmYyyy(r.asOf)}</td>
                  {zero && (
                    <td colSpan={0} className="hidden" />
                  )}
                </tr>
              );
            })}
            {rows.some((r) => Number(r.quantityOnHand) === 0) && (
              <tr className="bg-info-soft/40" data-testid="iv-sv-zero-note">
                <td colSpan={6} className="px-4 py-1.5 text-[11px] italic text-info-ink">
                  Rows with quantity 0 render inline — no movement as of this date,
                  quantity and value are zero.
                </td>
              </tr>
            )}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="iv-sv-totals-footer"
              >
                <td colSpan={3} className="px-4 py-3">
                  Total value
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    reconciles to Inventory control (1400)
                  </span>
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
