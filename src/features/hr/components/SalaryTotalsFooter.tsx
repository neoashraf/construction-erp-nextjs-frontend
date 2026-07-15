"use client";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

/**
 * Sticky totals footer (spec §5/§10). `aria-live="polite"` so screen readers announce
 * gross/deductions/net whenever the sheet totals recompute after a line/bulk edit.
 * Right-aligned money, monospace tabular-nums for column alignment. Money is `Decimal(18,4)`
 * — the string comes straight off the server response; we do not add or round it here.
 */
export function SalaryTotalsFooter({
  totalGross,
  totalDeductions,
  totalNet,
  saving,
}: {
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  saving?: boolean;
}) {
  return (
    <div
      role="region"
      aria-live="polite"
      data-testid="salary-totals"
      className={
        "sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-6 border-t border-border-strong bg-surface px-4 py-3 " +
        (saving ? "opacity-70" : "")
      }
    >
      <TotalCell label="Gross" value={totalGross} testId="total-gross" />
      <TotalCell label="Deductions" value={totalDeductions} testId="total-deductions" negative />
      <TotalCell label="Net" value={totalNet} testId="total-net" bold />
    </div>
  );
}

function TotalCell({
  label,
  value,
  testId,
  bold,
  negative,
}: {
  label: string;
  value: string;
  testId: string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</span>
      <span
        data-testid={testId}
        className={cn(
          "font-mono tabular-nums",
          bold ? "text-[15px] font-bold text-foreground" : "text-[13px]",
          negative ? "text-destructive" : "text-foreground",
        )}
      >
        {negative && "− "}৳ {formatMoney(value, { withSymbol: false })}
      </span>
    </div>
  );
}
