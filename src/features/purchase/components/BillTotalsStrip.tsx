"use client";

import { cn } from "@/lib/utils";
import { moneyWithSymbol } from "../format";
import { type BillTotals } from "../schemas/bill.schema";

/**
 * Live totals strip (brief §Scope 6; spec §5; Purchase Bill.dc.html "LIVE TOTALS STRIP").
 * A single bordered card split into five cells by vertical dividers: Gross · + VAT input ·
 * − TDS · − AIT · Net payable — the last cell wider, emphasised, and tinted. Client preview
 * reconciled to the server figure on Save/Post. `aria-live` polite so net-payable changes are
 * announced. `NET_PAYABLE_NEGATIVE` (FR-PUR-007) is surfaced by the parent editor as an inline
 * banner under this strip.
 */
export function BillTotalsStrip({
  totals,
  className,
}: {
  totals: BillTotals;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm sm:flex-row sm:items-stretch",
        className,
      )}
      aria-live="polite"
      data-testid="bill-totals-strip"
    >
      <Cell label="Gross ৳" value={totals.gross} />
      <Cell label="＋ VAT input ৳" value={totals.vatInput} tone="green" />
      <Cell label="− TDS ৳" value={totals.tds} tone="amber" />
      <Cell label="− AIT ৳" value={totals.ait} tone="amber" />
      <Cell
        label="Net payable ৳"
        value={totals.netPayable}
        emphasise
        error={totals.netPayableNegative}
        testId="bill-net-payable"
      />
    </div>
  );
}

function Cell({
  label,
  value,
  emphasise,
  error,
  tone,
  testId,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
  error?: boolean;
  tone?: "green" | "amber";
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 border-b border-border px-4 py-3.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0",
        emphasise && !error && "bg-accent-soft sm:flex-[1.35]",
        emphasise && error && "bg-destructive-soft sm:flex-[1.35]",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.4px]",
          emphasise ? (error ? "text-destructive-ink" : "text-success-ink") : "text-faint",
        )}
      >
        {label}
      </div>
      <div
        data-testid={testId}
        className={cn(
          "mt-1 font-mono tabular-nums",
          emphasise ? "text-[22px] font-bold" : "text-[17px] font-semibold",
          error
            ? "text-destructive-ink"
            : emphasise
              ? "text-success-ink"
              : tone === "green"
                ? "text-success-ink"
                : tone === "amber"
                  ? "text-warning-ink"
                  : "text-foreground",
        )}
      >
        {moneyWithSymbol(value)}
      </div>
    </div>
  );
}
