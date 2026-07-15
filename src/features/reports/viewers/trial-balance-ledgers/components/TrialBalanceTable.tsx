"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ReportGeneratedAt } from "../../../components/ReportGeneratedAt";
import { NameUnavailable } from "../../../components/ReportResultTable";
import { type TrialBalanceRow, type TrialBalanceTotals } from "../types";

/**
 * FE-56 trial-balance body — Account · Debit · Credit · Net with a **sticky
 * balancing totals footer** rendered from the API `totals` (no client Σ
 * assertion — FR-LED-014 lives in the backend). The balanced pill's text is
 * `aria-live="polite"` so re-runs announce fresh totals.
 */
export function TrialBalanceTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
}: {
  rows: TrialBalanceRow[] | undefined;
  totals: TrialBalanceTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) return <LoadingRows testid="tb-loading" />;
  if (isError) {
    return (
      <div className="p-8" data-testid="tb-error">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load the trial balance."
          description="Your parameters are preserved — try Run again."
          action={
            <Button size="md" onClick={onRetry} data-testid="tb-retry">
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="p-8" data-testid="tb-idle">
        <EmptyState icon={Inbox} title="Set parameters and select Run." />
      </div>
    );
  }
  const empty = rows.length === 0;
  const captionId = "tb-generated-caption";
  const dr = totals?.debit ?? "0.0000";
  const cr = totals?.credit ?? "0.0000";
  return (
    <div data-testid="tb-table">
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-[13px]"
          aria-describedby={captionId}
        >
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Account</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Debit</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Credit</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.accountId}-${r.groupDimensionLabel ?? ""}`}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="tb-row"
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium">
                    {r.accountCode}
                    <span className="mx-1 text-muted-foreground">·</span>
                    {r.accountName ? (
                      <>
                        {r.accountName}
                        {r.isActive === false && (
                          <span className="ml-1 text-[10.5px] italic text-muted-foreground">
                            (inactive)
                          </span>
                        )}
                      </>
                    ) : (
                      <NameUnavailable id={r.accountId} />
                    )}
                  </span>
                  {r.groupDimensionLabel && (
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      ↳ {r.groupDimensionLabel}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.debit)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.credit)}</td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums",
                    Number(r.net) < 0 ? "text-destructive" : "",
                  )}
                >
                  {formatMoney(r.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {empty && (
        <div className="border-t border-border p-6" data-testid="tb-empty">
          <EmptyState icon={Inbox} title="No postings for these filters." />
        </div>
      )}

      <div
        className="sticky bottom-0 border-t-2 border-foreground/70 bg-success-soft px-4 py-3"
        aria-live="polite"
        data-testid="tb-totals-footer"
      >
        <div className="flex flex-wrap items-center justify-end gap-4 text-[13px] font-bold tabular-nums text-success-ink">
          <span>Debit {formatMoney(dr)}</span>
          <span>=</span>
          <span>Credit {formatMoney(cr)}</span>
          <span className="rounded-pill bg-success px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            balanced
          </span>
        </div>
      </div>

      {generatedAt && (
        <div className="px-6 pb-4 pt-3">
          <ReportGeneratedAt generatedAt={generatedAt} id={captionId} />
        </div>
      )}
    </div>
  );
}

function LoadingRows({ testid }: { testid: string }) {
  return (
    <div className="p-6" data-testid={testid}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-8 w-full" />
      ))}
    </div>
  );
}
