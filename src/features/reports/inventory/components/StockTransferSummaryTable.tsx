"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatQty } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable, ddMmYyyy } from "./shared";
import {
  type StockTransferRow,
  type StockTransferTotals,
  type TransferMode,
} from "../types";

const MODE_LABEL: Record<TransferMode, string> = { TRANSFER: "Transfer", ISSUE: "Issue" };
const MODE_TONE: Record<TransferMode, React.ComponentProps<typeof Badge>["tone"]> = {
  TRANSFER: "info",
  ISSUE: "warning",
};

/**
 * FE-58 Stock transfer summary body (FR-RPT-023). One row per posted stock-
 * journal line over the date range; Voucher No. links back to the INV Stock
 * Journal viewer. Mode is a text-labelled pill (label + tone, never colour
 * alone — WCAG 1.4.1).
 */
export function StockTransferSummaryTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel = "No results for these filters.",
}: {
  rows: StockTransferRow[] | undefined;
  totals: StockTransferTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel?: string;
}) {
  if (isLoading) return <LoadingBody testid="iv-ts-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load the transfer summary."
        onRetry={onRetry}
        testid="iv-ts-error"
        retryTestid="iv-ts-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="iv-ts-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="iv-ts-empty" />;

  const captionId = "iv-ts-caption";
  return (
    <div data-testid="iv-ts-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Voucher No.</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Date</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">From godown</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">To godown</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Item</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Qty</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Value</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Mode</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Approver</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.stockJournalId}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="iv-ts-row"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/inventory/stock-journal/${r.stockJournalId}`}
                    className="font-mono text-[12.5px] text-accent-ink hover:underline"
                    aria-label={`Open Stock Journal ${r.voucherNo}`}
                  >
                    {r.voucherNo}
                  </Link>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{ddMmYyyy(r.voucherDate)}</td>
                <td className="px-4 py-2.5">
                  {r.fromGodownName ?? (r.fromGodownId ? <NameUnavailable id={r.fromGodownId} /> : "—")}
                </td>
                <td className="px-4 py-2.5">
                  {r.toGodownName ?? (r.toGodownId ? <NameUnavailable id={r.toGodownId} /> : "—")}
                </td>
                <td className="px-4 py-2.5">
                  {r.itemName ?? <NameUnavailable id={r.itemId} />}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatQty(r.quantity)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.value)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={MODE_TONE[r.mode]} dot data-testid={`iv-ts-mode-${r.mode}`}>
                    {MODE_LABEL[r.mode]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  {r.approverName ?? (r.approverId ? <NameUnavailable id={r.approverId} /> : "—")}
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="iv-ts-totals-footer"
              >
                <td colSpan={6} className="px-4 py-3">
                  Total value moved
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.totalValueMoved)}
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
