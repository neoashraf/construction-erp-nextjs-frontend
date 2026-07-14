"use client";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AlertCircle, Inbox } from "lucide-react";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { NameUnavailable } from "../../components/ReportResultTable";
import { type PnlTotals, type ProjectPnlRow } from "../types";

/**
 * FE-55 P&L body — Income section above Expense section, each subtotalled,
 * with the Profit band as the final row (spec §5). A loss (`profit < 0`) is
 * rendered parenthesised + carries a distinct "Loss" text label so meaning is
 * never colour-alone (FR-RPT-030). Cost-centre sub-rows (when the API returns
 * them) render indented under their parent account.
 */
export function ProfitLossStatement({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
}: {
  rows: ProjectPnlRow[] | undefined;
  totals: PnlTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) return <PnlLoading />;
  if (isError) {
    return (
      <div className="p-8" data-testid="pnl-error">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load the profit & loss statement."
          description="Your parameters are preserved — try Run again."
          action={
            <Button size="md" onClick={onRetry} data-testid="pnl-retry">
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="p-8" data-testid="pnl-idle">
        <EmptyState icon={Inbox} title="Set parameters and select Run." />
      </div>
    );
  }

  const income = rows.filter((r) => r.section === "INCOME");
  const expense = rows.filter((r) => r.section === "EXPENSE");
  const empty = income.length === 0 && expense.length === 0;
  const isLoss = totals ? Number(totals.profit) < 0 : false;
  const captionId = "pnl-generated-caption";

  return (
    <div data-testid="pnl-statement">
      <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
        <StatementSection
          heading="Income"
          rows={income}
          subtotal={totals?.revenue ?? "0.0000"}
          testid="pnl-income"
        />
        <StatementSection
          heading="Expense"
          rows={expense}
          subtotal={totals?.cost ?? "0.0000"}
          testid="pnl-expense"
        />
        <tfoot>
          <tr
            className={cn(
              "border-t-2 border-foreground/70",
              isLoss ? "bg-destructive-soft" : "bg-success-soft",
            )}
            aria-live="polite"
            data-testid="pnl-band"
            data-loss={isLoss ? "true" : "false"}
          >
            <td className="px-4 py-3 text-[13.5px] font-bold text-foreground" colSpan={2}>
              {isLoss ? "Loss" : "Profit"}
            </td>
            <td
              className={cn(
                "px-4 py-3 text-right text-[13.5px] font-bold tabular-nums",
                isLoss ? "text-destructive-ink" : "text-success-ink",
              )}
            >
              {formatSigned(totals?.profit ?? "0.0000")}
            </td>
          </tr>
        </tfoot>
      </table>
      {empty && (
        <div className="border-t border-border p-6" data-testid="pnl-empty">
          <EmptyState icon={Inbox} title="No postings for these filters." />
        </div>
      )}
      {generatedAt && (
        <div className="px-6 pb-4">
          <ReportGeneratedAt generatedAt={generatedAt} id={captionId} />
        </div>
      )}
    </div>
  );
}

function StatementSection({
  heading,
  rows,
  subtotal,
  testid,
}: {
  heading: string;
  rows: ProjectPnlRow[];
  subtotal: string;
  testid: string;
}) {
  return (
    <>
      <thead>
        <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
          <th
            scope="col"
            colSpan={3}
            className="h-11 px-4 text-left font-semibold text-foreground"
          >
            {heading}
          </th>
        </tr>
      </thead>
      <tbody data-testid={testid}>
        {rows.map((r, i) => (
          <tr
            key={`${r.accountId}-${r.costCentreId ?? ""}-${r.projectId ?? ""}-${i}`}
            className="border-b border-border/60 hover:bg-canvas/60"
            data-testid={`${testid}-row`}
          >
            <td className="px-4 py-2.5 text-muted-foreground">{r.accountCode}</td>
            <td className="px-4 py-2.5">
              {r.accountName ? (
                <span>
                  {r.accountName}
                  {r.isActive === false && (
                    <span className="ml-1 text-[10.5px] italic text-muted-foreground">
                      (inactive)
                    </span>
                  )}
                </span>
              ) : (
                <NameUnavailable id={r.accountId} />
              )}
              {r.costCentreName && (
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  ↳ {r.costCentreName}
                </div>
              )}
              {r.projectName && (
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  ↳ {r.projectName}
                </div>
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.amount)}</td>
          </tr>
        ))}
        <tr className="border-b border-border bg-canvas/40 text-[12.5px] font-bold text-foreground">
          <td className="px-4 py-2.5" colSpan={2}>
            Subtotal — {heading}
          </td>
          <td
            className="px-4 py-2.5 text-right tabular-nums"
            data-testid={`${testid}-subtotal`}
          >
            {formatMoney(subtotal)}
          </td>
        </tr>
      </tbody>
    </>
  );
}

function formatSigned(value: string): string {
  const n = Number(value);
  if (n < 0) return `(${formatMoney(Math.abs(n).toString())})`;
  return formatMoney(value);
}

function PnlLoading() {
  return (
    <div className="p-6" data-testid="pnl-loading">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-8 w-full" />
      ))}
    </div>
  );
}
