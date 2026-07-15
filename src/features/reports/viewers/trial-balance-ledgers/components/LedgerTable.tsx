"use client";

import { AlertCircle, Inbox, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { ReportGeneratedAt } from "../../../components/ReportGeneratedAt";
import { NameUnavailable } from "../../../components/ReportResultTable";
import { type LedgerMeta, type LedgerRow } from "../types";
import { SourceVoucherLink } from "./SourceVoucherLink";

/**
 * FE-56 shared ledger/daybook/cash-book table. All three reports return the
 * same row shape (`LedgerRow`); this component renders them with a sticky
 * top opening-balance banner (when meta carries one — ledger + cash-book) and
 * a per-row source-voucher link. Running balance is server-computed; never
 * recomputed here.
 */
export function LedgerTable({
  variant,
  rows,
  meta,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  showParty,
}: {
  variant: "LEDGER" | "DAYBOOK" | "CASH_BANK";
  rows: LedgerRow[] | undefined;
  /** Ledger + cash-book carry opening-balance meta; daybook is null. */
  meta: LedgerMeta | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  showParty: boolean;
}) {
  const emptyLabel = variant === "DAYBOOK" ? "No activity in this period." : "No activity in this period.";
  const errorTitle =
    variant === "LEDGER"
      ? "Couldn't load this ledger."
      : variant === "DAYBOOK"
        ? "Couldn't load the daybook."
        : "Couldn't load the cash & bank book.";

  if (isLoading) {
    return (
      <div className="p-6" data-testid="ledger-loading">
        {meta && <Skeleton className="mb-3 h-9 w-72" data-testid="ledger-opening-skeleton" />}
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-8 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-8" data-testid="ledger-error">
        <EmptyState
          icon={AlertCircle}
          title={errorTitle}
          description="Your parameters are preserved — try Run again."
          action={
            <Button size="md" onClick={onRetry} data-testid="ledger-retry">
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="p-8" data-testid="ledger-idle">
        <EmptyState icon={Inbox} title="Set parameters and select Run." />
      </div>
    );
  }
  const empty = rows.length === 0;
  const captionId = "ledger-generated-caption";

  return (
    <div data-testid="ledger-table">
      {meta && (
        <div
          className="sticky top-0 z-10 border-b border-info/40 bg-info-soft px-4 py-2 text-[12px] text-info-ink"
          data-testid="ledger-opening-banner"
        >
          <span className="font-semibold">Opening balance: </span>
          <span className="tabular-nums">{formatMoney(meta.openingBalance)}</span>
          {meta.openingAsOf && (
            <span className="ml-1 text-muted-foreground">
              (as of {safeFormat(meta.openingAsOf)})
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-[13px]"
          aria-describedby={captionId}
        >
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Date</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Entry no.</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Voucher type</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Source</th>
              {showParty && (
                <th scope="col" className="h-11 px-4 text-left font-semibold">Party</th>
              )}
              <th scope="col" className="h-11 px-4 text-right font-semibold">Debit</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Credit</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">
                Running balance
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.entryId}-${r.accountId}`}
                className={cn(
                  "border-b border-border/60 hover:bg-canvas/60",
                  r.isReversal && "bg-warning-soft/40",
                )}
                data-testid="ledger-row"
              >
                <td className="px-4 py-2.5 tabular-nums">{safeFormat(r.voucherDate)}</td>
                <td className="px-4 py-2.5">
                  <SourceVoucherLink row={r} />
                  {r.isReversal && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-pill bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning-ink"
                      aria-label="Reversal"
                    >
                      <RotateCcw className="h-2.5 w-2.5" aria-hidden />
                      Reversal
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.voucherType}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {r.accountName ? (
                    <>
                      {r.accountCode} · {r.accountName}
                      {r.isInactive && (
                        <span className="ml-1 text-[10.5px] italic">(inactive)</span>
                      )}
                    </>
                  ) : (
                    <NameUnavailable id={r.accountId} />
                  )}
                </td>
                {showParty && (
                  <td className="px-4 py-2.5 text-muted-foreground">{r.partyName ?? "—"}</td>
                )}
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.debit)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.credit)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {formatMoney(r.runningBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {empty && (
        <div className="border-t border-border p-6" data-testid="ledger-empty">
          <EmptyState icon={Inbox} title={emptyLabel} />
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

function safeFormat(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}
