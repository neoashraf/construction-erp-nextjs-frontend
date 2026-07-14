"use client";

import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

/**
 * Balanced indicator for the voucher editor (spec §5; FR-GEN-016). Client-computed
 * pre-flight — the authoritative Σdebit=Σcredit check runs server-side at post.
 * `aria-live="polite"` so screen-reader users hear the state change without needing
 * to re-navigate. Text label + tone dot (never colour alone).
 */
export function BalancedIndicator({
  debit,
  credit,
  balanced,
  diff,
}: {
  debit: string;
  credit: string;
  balanced: boolean;
  diff: string;
}) {
  const empty = Number(debit) === 0 && Number(credit) === 0;
  return (
    <div
      aria-live="polite"
      className="inline-flex flex-wrap items-center gap-3 rounded-token border border-border bg-surface-2 px-4 py-2 text-[12.5px]"
      data-testid="voucher-balanced-indicator"
    >
      <span className="text-muted-foreground">
        Σ Dr <span className="font-mono tabular-nums text-foreground">{formatMoney(debit)}</span>
      </span>
      <span className="text-muted-foreground">
        Σ Cr <span className="font-mono tabular-nums text-foreground">{formatMoney(credit)}</span>
      </span>
      {empty ? (
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-[12px] font-semibold text-muted-foreground">
          <Circle className="h-3 w-3" aria-hidden />
          Enter amounts to balance.
        </span>
      ) : balanced ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1 text-[12px] font-semibold text-success-ink",
          )}
          data-testid="voucher-balanced-ok"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Balanced
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 rounded-pill bg-destructive-soft px-3 py-1 text-[12px] font-semibold text-destructive-ink"
          data-testid="voucher-balanced-off"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Out of balance by ৳{formatMoney(diff)}
        </span>
      )}
    </div>
  );
}
