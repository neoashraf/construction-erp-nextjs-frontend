"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable } from "./shared";
import { CostCentreStatusBadge } from "./CostCentreStatusBadge";
import {
  type CostCentreVarianceRow,
  type CostCentreVarianceTotals,
} from "../types";

/**
 * FE-59 Cost-centre variance body (FR-RPT-025). Renders CC's canonical
 * `budgetedAmount / actualCost / variance / utilisationPct / status` verbatim
 * (FR-CC-010, FR-RPT-004) — the FE performs no variance/utilisation
 * recomputation. `UNBUDGETED` shows budgeted/variance/util as "—", actual
 * still shown, status = "Unbudgeted".
 */
export function CostCentreVarianceTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel = "No results for these filters.",
}: {
  rows: CostCentreVarianceRow[] | undefined;
  totals: CostCentreVarianceTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel?: string;
}) {
  if (isLoading) return <LoadingBody testid="rcc-ccv-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load cost-centre variance."
        onRetry={onRetry}
        testid="rcc-ccv-error"
        retryTestid="rcc-ccv-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="rcc-ccv-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="rcc-ccv-empty" />;

  const captionId = "rcc-ccv-caption";
  return (
    <div data-testid="rcc-ccv-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Project</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Cost centre</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Budgeted</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Actual</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Variance</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Util. %</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const highlight =
                r.status === "OVER"
                  ? "bg-destructive-soft/40"
                  : r.status === "APPROACHING"
                    ? "bg-warning-soft/40"
                    : undefined;
              return (
                <tr
                  key={`${r.projectId}-${r.costCentreId}`}
                  className={cn("border-b border-border/60 hover:bg-canvas/60", highlight)}
                  data-testid="rcc-ccv-row"
                >
                  <td className="px-4 py-2.5">
                    {r.projectName ?? <NameUnavailable id={r.projectId} />}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.costCentreName ? (
                      <Link
                        href={`/reports/trial-balance-ledgers?costCentreId=${r.costCentreId}`}
                        className="font-medium text-accent-ink hover:underline"
                        aria-label={`Open ledger for cost centre ${r.costCentreCode ?? r.costCentreId}`}
                      >
                        {r.costCentreCode}
                        <span className="mx-1 text-muted-foreground">·</span>
                        {r.costCentreName}
                      </Link>
                    ) : (
                      <NameUnavailable id={r.costCentreCode ?? r.costCentreId} />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.budgetedAmount ? formatMoney(r.budgetedAmount) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatMoney(r.actualCost)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums",
                      r.variance !== null && Number(r.variance) < 0 && "text-destructive",
                    )}
                  >
                    {r.variance !== null ? formatMoney(r.variance) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.utilisationPct !== null ? `${Number(r.utilisationPct).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <CostCentreStatusBadge status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="rcc-ccv-totals-footer"
              >
                <td colSpan={2} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.budgeted)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.actual)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.variance)}
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
