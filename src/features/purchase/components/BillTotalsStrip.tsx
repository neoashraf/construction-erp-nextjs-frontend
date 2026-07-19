"use client";

import { cn } from "@/lib/utils";
import { moneyWithSymbol } from "../format";
import { type BillTotals } from "../schemas/bill.schema";

/**
 * Live totals strip (brief §Scope 6; spec §5). Gross · VAT input · TDS · AIT · Net
 * payable — client preview reconciled to the server figure on Save/Post. `aria-live`
 * polite so net-payable changes are announced as the user edits. `NET_PAYABLE_NEGATIVE`
 * (FR-PUR-007) is surfaced by the parent editor as an inline banner under this strip.
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
        "grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-2 px-4 py-3 md:grid-cols-5",
        className,
      )}
      aria-live="polite"
      data-testid="bill-totals-strip"
    >
      <Cell label="Gross" value={totals.gross} />
      <Cell label="+ VAT input" value={totals.vatInput} tone="green" />
      <Cell label="− TDS" value={totals.tds} tone="amber" />
      <Cell label="− AIT" value={totals.ait} tone="amber" />
      <Cell
        label="Net payable"
        value={totals.netPayable}
        emphasise
        highlight={totals.netPayableNegative ? "error" : "net"}
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
  highlight,
  testId,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
  error?: boolean;
  tone?: "green" | "amber";
  highlight?: "net" | "error";
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-token px-2 py-1",
        highlight === "net" && "bg-accent-soft",
        highlight === "error" && "bg-destructive-soft",
      )}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </div>
      <div
        data-testid={testId}
        className={cn(
          "mt-0.5 font-mono tabular-nums",
          emphasise ? "text-[16px] font-bold" : "text-[13px] font-semibold",
          error
            ? "text-destructive-ink"
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
