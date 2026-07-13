"use client";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
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
      <Cell label="+ VAT input" value={totals.vatInput} />
      <Cell label="− TDS" value={totals.tds} />
      <Cell label="− AIT" value={totals.ait} />
      <Cell
        label="Net payable"
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
  testId,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
  error?: boolean;
  testId?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </div>
      <div
        data-testid={testId}
        className={cn(
          "mt-0.5 font-mono tabular-nums",
          emphasise ? "text-[16px] font-bold" : "text-[13px] font-semibold",
          error ? "text-destructive-ink" : "text-foreground",
        )}
      >
        {formatMoney(value)}
      </div>
    </div>
  );
}
