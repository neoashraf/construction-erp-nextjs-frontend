"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatQty } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, InactiveTag, LoadingBody, NameUnavailable } from "./shared";
import {
  type RequisitionVsIssueRow,
  type RequisitionVsIssueTotals,
} from "../types";

/**
 * FE-59 Requisition vs issue body (FR-RPT-024). Requested / issued are REQ's
 * verbatim; `varianceQty = requested − issued` is REQ's own derived value,
 * NOT a new source total (spec §5, §9). Variance carries a label + colour +
 * dot — never colour alone (WCAG 1.4.1).
 */
export function RequisitionVsIssueTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel = "No results for these filters.",
}: {
  rows: RequisitionVsIssueRow[] | undefined;
  totals: RequisitionVsIssueTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel?: string;
}) {
  if (isLoading) return <LoadingBody testid="rcc-rvi-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load requisition vs issue."
        onRetry={onRetry}
        testid="rcc-rvi-error"
        retryTestid="rcc-rvi-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="rcc-rvi-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="rcc-rvi-empty" />;

  const captionId = "rcc-rvi-caption";
  return (
    <div data-testid="rcc-rvi-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Requisition</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Item</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Requested</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Issued</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const v = Number(r.varianceQty);
              return (
                <tr
                  key={`${r.requisitionId}-${r.itemId}-${i}`}
                  className="border-b border-border/60 hover:bg-canvas/60"
                  data-testid="rcc-rvi-row"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/requisitions/${r.requisitionId}/outstanding`}
                      className="font-mono text-[12.5px] text-accent-ink hover:underline"
                      aria-label={`Open outstanding for ${r.requisitionNo}`}
                    >
                      {r.requisitionNo}
                    </Link>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {r.projectName ?? <NameUnavailable id={r.projectId ?? "—"} />}
                      <span className="mx-1">·</span>
                      {r.costCentreName ? (
                        <>
                          {r.costCentreCode}
                          <span className="mx-1">·</span>
                          {r.costCentreName}
                          {r.costCentreInactive && <InactiveTag />}
                        </>
                      ) : (
                        <NameUnavailable id={r.costCentreCode ?? r.costCentreId ?? "—"} />
                      )}
                    </div>
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
                    {formatQty(r.requestedQty)}
                    {r.unit && <span className="ml-1 text-[11px] text-muted-foreground">{r.unit}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatQty(r.issuedQty)}
                    {r.unit && <span className="ml-1 text-[11px] text-muted-foreground">{r.unit}</span>}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums",
                      v > 0 && "text-warning-ink",
                      v < 0 && "text-destructive",
                    )}
                  >
                    <div className="inline-flex items-center gap-2">
                      <VarianceDot v={v} />
                      <span data-testid="rcc-rvi-variance">
                        {formatQty(r.varianceQty)}
                        {r.unit && <span className="ml-1 text-[11px] text-muted-foreground">{r.unit}</span>}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totals && (
        <div
          className="flex flex-wrap items-center gap-3 border-t border-border bg-canvas px-4 py-3 text-[12px]"
          data-testid="rcc-rvi-summary"
        >
          <Badge tone="neutral">Lines {String(totals.lineCount)}</Badge>
          <Badge tone="success">Fully issued {String(totals.fullyIssued)}</Badge>
          <Badge tone="warning">Outstanding {String(totals.outstanding)}</Badge>
        </div>
      )}
      {generatedAt && (
        <div className="px-6 pb-4 pt-3">
          <ReportGeneratedAt generatedAt={generatedAt} id={captionId} />
        </div>
      )}
    </div>
  );
}

function VarianceDot({ v }: { v: number }) {
  const cls = v > 0 ? "bg-warning" : v < 0 ? "bg-destructive" : "bg-success";
  const label = v > 0 ? "outstanding" : v < 0 ? "over-issued" : "fully issued";
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full", cls)}
      aria-label={label}
    />
  );
}
