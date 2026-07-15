"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { CostCentreCell, EmptyBody, ErrorBody, IdleBody, LoadingBody } from "./shared";
import { type ProjectPnlRow, type ProjectPnlTotals } from "../types";

/**
 * FE-57 Project P&L body — Cost centre · Revenue · Cost · Profit + a
 * "Project total" row (`costCentreId === null`) rendered as a `<tfoot>`
 * with the totals block. Profit is CC's project-profitability figure
 * rendered verbatim — FR-CC-009/-010, no client Σ (FR-RPT-003/-004).
 */
export function ProjectPnlTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: ProjectPnlRow[] | undefined;
  totals: ProjectPnlTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBody testid="pi-pnl-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load the project P&L."
        onRetry={onRetry}
        testid="pi-pnl-error"
        retryTestid="pi-pnl-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="pi-pnl-idle" />;

  // Split rows: cost-centre lines + the optional "Project total" row.
  const ccRows = rows.filter((r) => r.costCentreId !== null);
  const projectTotalRow = rows.find((r) => r.costCentreId === null);

  if (ccRows.length === 0) {
    return <EmptyBody label={emptyLabel} testid="pi-pnl-empty" />;
  }

  const captionId = "pi-pnl-caption";
  return (
    <div data-testid="pi-pnl-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Cost centre</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Revenue</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Cost</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Profit</th>
            </tr>
          </thead>
          <tbody>
            {ccRows.map((r) => (
              <tr
                key={r.costCentreId ?? "row"}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="pi-pnl-row"
              >
                <td className="px-4 py-2.5">
                  {r.costCentreId ? (
                    <Link
                      href={`/reports/trial-balance-ledgers?costCentreId=${r.costCentreId}`}
                      className="font-medium text-accent-ink hover:underline"
                      aria-label={`Open ledger for cost centre ${r.costCentreCode ?? r.costCentreId}`}
                    >
                      <CostCentreCell
                        code={r.costCentreCode}
                        name={r.costCentreName}
                        fallbackId={r.costCentreId}
                      />
                    </Link>
                  ) : (
                    <CostCentreCell code={r.costCentreCode} name={r.costCentreName} />
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.revenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.cost)}</td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums",
                    Number(r.profit) < 0 && "text-destructive",
                  )}
                >
                  {formatMoney(r.profit)}
                </td>
              </tr>
            ))}
            {projectTotalRow && (
              <tr
                className="border-b border-border bg-canvas font-bold"
                data-testid="pi-pnl-project-total-row"
              >
                <td className="px-4 py-2.5">Project total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(projectTotalRow.revenue)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(projectTotalRow.cost)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums",
                    Number(projectTotalRow.profit) < 0 && "text-destructive",
                  )}
                >
                  {formatMoney(projectTotalRow.profit)}
                </td>
              </tr>
            )}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="pi-pnl-totals-footer"
              >
                <td className="px-4 py-3">Totals</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.revenue)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.cost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.profit)}</td>
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
