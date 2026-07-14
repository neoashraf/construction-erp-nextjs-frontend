"use client";

import { ArrowDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { balanceDueAfter } from "../schemas/receipt.schema";

/**
 * Live balance-due-after panel (spec §5/§9; design "balance-due panel"). Recomputes
 * client-side on every amount-settled/tax change off the last-fetched `balanceDue`; an
 * **optimistic preview** — the authoritative check runs again server-side at Post
 * (FR-REC-017/018, edge cases 5/8). `aria-live="polite"` so the recomputed figure is
 * announced to screen readers as the user types.
 */
export function BalanceDuePanel({
  outstanding,
  amountSettled,
  loading,
}: {
  outstanding: string | null;
  amountSettled: string;
  loading: boolean;
}) {
  if (loading && outstanding == null) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (outstanding == null) return null;
  const remaining = balanceDueAfter(outstanding, amountSettled);
  return (
    <div
      aria-live="polite"
      className="rounded-card border border-border bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
      data-testid="receipt-balance-due"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-muted-foreground">IPC currently due</span>
        <span className="font-mono text-[13.5px] font-semibold tabular-nums text-foreground">
          {formatMoney(outstanding)}
        </span>
      </div>
      <div className="my-2 flex items-center gap-2">
        <span className="flex-1 h-px bg-border" />
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowDown className="h-3 w-3" aria-hidden />
          less this receipt {formatMoney(amountSettled || "0")}
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>
      <div className="flex items-center justify-between rounded-token bg-accent-soft px-3 py-2">
        <span className="text-[12.5px] font-semibold text-accent-ink">Balance due after this receipt</span>
        <span
          className="font-mono text-[15px] font-bold tabular-nums text-accent-ink"
          data-testid="receipt-balance-after"
        >
          {formatMoney(remaining)}
        </span>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
        Optimistic preview — the authoritative outstanding check runs again server-side at Post.
      </p>
    </div>
  );
}
