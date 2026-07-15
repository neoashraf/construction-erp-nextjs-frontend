"use client";

import { formatMoney } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { CostCentreCell, EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable } from "./shared";
import { type LabourCostRow, type LabourCostTotals } from "../types";

/**
 * FE-57 Labour cost body (FR-RPT-019, spec §5). One row per (Project, Cost
 * centre) + a "Total labour cost" footer from `meta.totals.labourCost`. LED's
 * labour EXPENSE grouped by CC — rendered, never re-summed.
 */
export function LabourCostTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: LabourCostRow[] | undefined;
  totals: LabourCostTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBody testid="pi-lc-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load labour cost."
        onRetry={onRetry}
        testid="pi-lc-error"
        retryTestid="pi-lc-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="pi-lc-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="pi-lc-empty" />;

  const captionId = "pi-lc-caption";
  return (
    <div data-testid="pi-lc-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Project</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Cost centre</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Labour cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.projectId}-${r.costCentreId}`}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="pi-lc-row"
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
                  {formatMoney(r.labourCost)}
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="pi-lc-totals-footer"
              >
                <td className="px-4 py-3" colSpan={2}>
                  Total labour cost
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.labourCost)}
                </td>
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
