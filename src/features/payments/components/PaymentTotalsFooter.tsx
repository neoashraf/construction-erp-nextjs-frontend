"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import {
  allocatedTotal,
  isFullyAllocated,
  isOverAllocated,
  unallocatedRemainder,
  type AllocationRow,
} from "../schemas/payment.schema";

/**
 * Payment totals + Balanced indicator (spec §5 Live totals; FR-PAY-005/-012). Recomputes
 * on every change client-side (no server round-trip); `aria-live="polite"` so a screen
 * reader announces the updated totals. Post is gated open **only** when the payment is
 * fully allocated (Phase-1 full-allocation rule, spec §14 Open item 1).
 */
export function PaymentTotalsFooter({
  paymentAmount,
  bankChargesAmount,
  rows,
  totalsId,
}: {
  paymentAmount: string;
  bankChargesAmount: string;
  rows: AllocationRow[];
  totalsId?: string;
}) {
  const sum = allocatedTotal(rows);
  const remainder = unallocatedRemainder(paymentAmount, rows);
  const over = isOverAllocated(paymentAmount, rows);
  const balanced = isFullyAllocated(paymentAmount, rows);
  const totalOut = (Number(paymentAmount || "0") + Number(bankChargesAmount || "0")).toFixed(4);

  const hasBankCharges = Number(bankChargesAmount || "0") > 0;
  return (
    <Card
      aria-live="polite"
      id={totalsId}
      className="flex flex-col gap-3 p-4"
      data-testid="payment-totals-footer"
    >
      <div className="flex flex-wrap items-center gap-5">
        <Cell label="Σ allocations" value={sum} testId="payment-totals-sum" />
        <Cell
          label="Unallocated · advance / on-account"
          value={remainder}
          testId="payment-totals-unallocated"
          tone={over ? "destructive" : remainder === "0.0000" ? "muted" : "warning"}
        />
        <Cell label="Bank charges" value={bankChargesAmount || "0"} testId="payment-totals-bank-charges" tone={hasBankCharges ? "warning" : "muted"} />
        {/* Total cash out — navy filled callout (design summary strip). */}
        <div className="ml-auto rounded-card bg-primary px-4 py-2.5 text-right" data-testid="payment-totals-cashout-box">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-primary-foreground/70">Total cash out</div>
          <div className="mt-0.5 font-mono text-[18px] font-bold tabular-nums text-primary-foreground" data-testid="payment-totals-cashout">
            {formatMoney(totalOut, { fractionDigits: 2 })}
          </div>
        </div>
      </div>
      <div className="flex items-center border-t border-border pt-3" data-testid="payment-balance-indicator">
        {over ? (
          <span className="inline-flex items-center gap-1.5 rounded-token bg-destructive-soft px-3 py-1.5 text-[12.5px] font-semibold text-destructive-ink">
            <AlertCircle className="h-4 w-4" aria-hidden />
            Over-allocated
          </span>
        ) : balanced ? (
          <span className="inline-flex items-center gap-1.5 rounded-token bg-success-soft px-3 py-1.5 text-[12.5px] font-semibold text-success-ink">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Balanced — fully allocated
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-token bg-warning-soft px-3 py-1.5 text-[12.5px] font-semibold text-warning-ink"
            data-testid="payment-balance-indicator-unallocated"
          >
            <AlertCircle className="h-4 w-4" aria-hidden />
            Unallocated: ৳{formatMoney(remainder, { fractionDigits: 2 })} — allocate the full amount to post
          </span>
        )}
      </div>
    </Card>
  );
}

function Cell({
  label,
  value,
  testId,
  tone = "default",
  strong,
}: {
  label: string;
  value: string;
  testId?: string;
  tone?: "default" | "muted" | "warning" | "destructive";
  strong?: boolean;
}) {
  const cls =
    tone === "destructive"
      ? "text-destructive-ink"
      : tone === "warning"
        ? "text-warning-ink"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="min-w-[140px]">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 font-mono tabular-nums ${strong ? "text-[16px] font-bold" : "text-[13.5px] font-semibold"} ${cls}`}
        data-testid={testId}
      >
        {formatMoney(value, { fractionDigits: 2 })}
      </div>
    </div>
  );
}
