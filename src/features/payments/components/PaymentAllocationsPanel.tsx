"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { PayableTypeBadge } from "./PayableTypeBadge";
import { type PaymentAllocation, type PayableType } from "../types";

/**
 * Payment viewer allocations panel (spec §5; FR-PAY-007/-017). Each row shows the
 * payable's reference, type badge, amount allocated, (accrued for LABOUR_PAYABLE),
 * and links to the source payable / per-payable Outstanding view.
 */
export function PaymentAllocationsPanel({ allocations }: { allocations: PaymentAllocation[] }) {
  if (allocations.length === 0) {
    return (
      <Card className="mt-4 p-5" data-testid="payment-allocations-empty">
        <div className="text-[13px] text-muted-foreground">No allocations on this payment.</div>
      </Card>
    );
  }
  return (
    <Card className="mt-4 overflow-hidden" data-testid="payment-allocations-panel">
      <div className="border-b border-border bg-surface-2 px-5 py-3.5">
        <h2 className="text-[13px] font-bold text-foreground">Allocations</h2>
      </div>
      <div className="grid grid-cols-[1.6fr_0.7fr_1fr_1fr_auto] gap-2 px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        <span>Payable ref</span>
        <span>Type</span>
        <span className="text-right">Amount allocated</span>
        <span className="text-right">Accrued (labour)</span>
        <span />
      </div>
      {allocations.map((a) => (
        <div
          key={`${a.payableType}:${a.payableId}`}
          className="grid grid-cols-[1.6fr_0.7fr_1fr_1fr_auto] items-center gap-2 border-t border-border px-5 py-3 text-[13px]"
          data-testid={`payment-allocation-${a.payableId}`}
        >
          <Link
            href={outstandingLinkFor(a.payableType, a.payableId)}
            className="min-w-0 truncate font-mono font-semibold text-accent-ink hover:underline"
            title={a.payableId}
          >
            {a.payableId}
          </Link>
          <span><PayableTypeBadge type={a.payableType} /></span>
          <span className="text-right font-mono tabular-nums text-foreground">{formatMoney(a.amountAllocated)}</span>
          <span className={a.accruedAmount != null ? "text-right font-mono tabular-nums text-warning-ink" : "text-right font-mono tabular-nums text-faint"}>
            {a.accruedAmount != null ? formatMoney(a.accruedAmount) : "—"}
          </span>
          <Link
            href={outstandingLinkFor(a.payableType, a.payableId)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink hover:underline"
            data-testid={`payment-allocation-link-${a.payableId}`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View
          </Link>
        </div>
      ))}
    </Card>
  );
}

function outstandingLinkFor(type: PayableType, id: string): string {
  // Deep-link into the Payments list Outstanding view — the source payable's page
  // lives in PUR/HR (Tier-2 modules not owned here). Server enforces scope.
  return `/payments?payableType=${type}&payableId=${id}`;
}
