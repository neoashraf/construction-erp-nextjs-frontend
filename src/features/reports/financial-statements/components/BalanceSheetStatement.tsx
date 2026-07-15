"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { NameUnavailable } from "../../components/ReportResultTable";
import { type BalanceSheetRow, type BalanceSheetTotals, type BsGroupKind } from "../types";

/**
 * FE-55 balance-sheet body — Assets above Liabilities + Equity, grouped by
 * AccountGroup (from `groupLabel`), with the reconciling footer
 * "Assets ৳X = Liabilities ৳Y + Equity ৳Z" (FR-RPT-014). The FE never re-
 * verifies the identity — it renders whatever the API returned; a mismatch
 * (project-wise partial) shows "Partial" instead of "Balanced".
 */
export function BalanceSheetStatement({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  partial,
}: {
  rows: BalanceSheetRow[] | undefined;
  totals: BalanceSheetTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** True for project-wise (the balance intentionally may not tie). */
  partial: boolean;
}) {
  if (isLoading) return <BsLoading />;
  if (isError) {
    return (
      <div className="p-8" data-testid="bs-error">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load the balance sheet."
          description="Your parameters are preserved — try Run again."
          action={
            <Button size="md" onClick={onRetry} data-testid="bs-retry">
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="p-8" data-testid="bs-idle">
        <EmptyState icon={Inbox} title="Set parameters and select Run." />
      </div>
    );
  }

  const assets = groupByKind(rows, "ASSET");
  const liabilities = groupByKind(rows, "LIABILITY");
  const equity = groupByKind(rows, "EQUITY");
  const empty = assets.size === 0 && liabilities.size === 0 && equity.size === 0;
  const captionId = "bs-generated-caption";

  return (
    <div data-testid="bs-statement">
      <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
        <SectionBlock heading="Assets" groups={assets} subtotal={totals?.assets ?? "0.0000"} testid="bs-assets" />
        <SectionBlock heading="Liabilities" groups={liabilities} subtotal={totals?.liabilities ?? "0.0000"} testid="bs-liabilities" />
        <SectionBlock heading="Equity" groups={equity} subtotal={totals?.equity ?? "0.0000"} testid="bs-equity" />
        <tfoot>
          <tr
            className={cn(
              "border-t-2 border-foreground/70",
              partial ? "bg-warning-soft" : "bg-success-soft",
            )}
            aria-live="polite"
            data-testid="bs-band"
            data-partial={partial ? "true" : "false"}
          >
            <td
              className={cn(
                "px-4 py-3 text-[13.5px] font-bold",
                partial ? "text-warning-ink" : "text-success-ink",
              )}
              colSpan={3}
            >
              {partial ? "Partial" : "Balanced"} — Assets {formatMoney(totals?.assets ?? "0")} ={" "}
              Liabilities {formatMoney(totals?.liabilities ?? "0")} + Equity{" "}
              {formatMoney(totals?.equity ?? "0")}
            </td>
          </tr>
        </tfoot>
      </table>
      {empty && (
        <div className="border-t border-border p-6" data-testid="bs-empty">
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

function SectionBlock({
  heading,
  groups,
  subtotal,
  testid,
}: {
  heading: string;
  groups: Map<string, BalanceSheetRow[]>;
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
        {Array.from(groups.entries()).flatMap(([groupLabel, list]) => [
          <tr
            key={`group-${groupLabel}`}
            className="border-b border-border/60 bg-canvas/30 text-[11.5px] uppercase tracking-wide text-muted-foreground"
          >
            <td className="px-4 py-2" colSpan={3} data-testid={`${testid}-group`}>
              {groupLabel}
            </td>
          </tr>,
          ...list.map((r) => (
            <tr
              key={`${r.accountId}-${r.groupLabel}`}
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
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.amount)}</td>
            </tr>
          )),
          (() => {
            const total = list.reduce((a, r) => a + Number(r.amount), 0);
            return (
              <tr
                key={`sub-${groupLabel}`}
                className="border-b border-border bg-canvas/50 text-[12px] font-semibold"
              >
                <td className="px-4 py-2" colSpan={2}>
                  Subtotal — {groupLabel}
                </td>
                <td className="px-4 py-2 text-right tabular-nums" data-testid={`${testid}-group-subtotal`}>
                  {formatMoney(total.toString())}
                </td>
              </tr>
            );
          })(),
        ])}
        <tr className="border-b border-border bg-canvas/60 text-[12.5px] font-bold text-foreground">
          <td className="px-4 py-2.5" colSpan={2}>
            Total {heading}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums" data-testid={`${testid}-subtotal`}>
            {formatMoney(subtotal)}
          </td>
        </tr>
      </tbody>
    </>
  );
}

function groupByKind(rows: BalanceSheetRow[], kind: BsGroupKind): Map<string, BalanceSheetRow[]> {
  const map = new Map<string, BalanceSheetRow[]>();
  for (const r of rows) {
    if (r.groupKind !== kind) continue;
    const list = map.get(r.groupLabel) ?? [];
    list.push(r);
    map.set(r.groupLabel, list);
  }
  return map;
}

function BsLoading() {
  return (
    <div className="p-6" data-testid="bs-loading">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-8 w-full" />
      ))}
    </div>
  );
}
