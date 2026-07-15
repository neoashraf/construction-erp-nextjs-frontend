"use client";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { CostCentreCell, EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable } from "./shared";
import { CostCentreStatusBadge } from "./CostCentreStatusBadge";
import {
  type CostCentreVarianceRow,
  type CostCentreVarianceTotals,
} from "../types";

/**
 * FE-57 material-consumption-vs-budget body (FR-RPT-018, spec §5). CC figures
 * are rendered verbatim (FR-RPT-004); `UNBUDGETED` collapses Budgeted /
 * Variance / Util.% to em-dash per the design & spec §5.
 */
export function MaterialConsumptionTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: CostCentreVarianceRow[] | undefined;
  totals: CostCentreVarianceTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBody testid="pi-mc-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load material consumption vs budget."
        onRetry={onRetry}
        testid="pi-mc-error"
        retryTestid="pi-mc-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="pi-mc-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="pi-mc-empty" />;

  const captionId = "pi-mc-caption";
  return (
    <div data-testid="pi-mc-table">
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
            {rows.map((r) => (
              <tr
                key={`${r.projectId}-${r.costCentreId}`}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="pi-mc-row"
              >
                <td className="px-4 py-2.5">
                  {r.projectName ?? <NameUnavailable id={r.projectId} />}
                </td>
                <td className="px-4 py-2.5">
                  <CostCentreCell
                    code={r.costCentreCode}
                    name={r.costCentreName}
                    fallbackId={r.costCentreId}
                  />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.budgetedAmount ? formatMoney(r.budgetedAmount) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(r.actualAmount)}
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
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="pi-mc-totals-footer"
              >
                <td className="px-4 py-3" colSpan={2}>
                  Totals
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.budgeted)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.actual)}</td>
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
