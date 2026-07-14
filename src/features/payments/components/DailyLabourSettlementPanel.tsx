"use client";

import Decimal from "decimal.js";
import { toDecimal } from "@/lib/money";
import { formatMoney } from "@/lib/money";
import { type AllocationRow } from "../schemas/payment.schema";

/**
 * Daily-labour settlement panel (spec §5; FR-PAY-015). Rendered inline under a
 * `LABOUR_PAYABLE` allocation row. Shows accrued vs paid + the live Dr/Cr Labour-Cost
 * true-up (Cr when paid < accrued, Dr when paid > accrued; "No true-up" when exact).
 * The payable clears at its full accrued amount. Phase-1 shows unconditionally — no
 * tolerance band (spec §14 Open item 2).
 */
export function DailyLabourSettlementPanel({ row }: { row: AllocationRow }) {
  const accrued = safeDec(row.accruedAmount ?? row.originalAmount);
  const paid = safeDec(row.amountAllocated);
  const diff = paid.minus(accrued);
  const isZero = diff.isZero();
  const overpaid = diff.greaterThan(0);
  const abs = diff.abs().toFixed(4);
  const line = isZero
    ? "No true-up — paid matches accrued exactly."
    : overpaid
      ? `Dr Labour Cost ৳${formatMoney(abs)} — paid exceeds accrued`
      : `Cr Labour Cost ৳${formatMoney(abs)} — paid short of accrued`;
  return (
    <div
      aria-live="polite"
      className="rounded-token border border-border bg-surface-2 p-3"
      data-testid={`payment-labour-trueup-${row.payableId}`}
    >
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        Daily-labour true-up
      </div>
      <div className="grid grid-cols-2 gap-2 text-[12.5px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Accrued</span>
          <span className="font-mono tabular-nums text-foreground">{formatMoney(accrued)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Paid (this settlement)</span>
          <span className="font-mono tabular-nums text-foreground">{formatMoney(paid)}</span>
        </div>
      </div>
      <div className="mt-2 border-t border-border pt-2 text-[12px] font-semibold text-foreground">{line}</div>
    </div>
  );
}

function safeDec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}
