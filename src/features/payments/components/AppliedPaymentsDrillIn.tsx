"use client";

import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { usePayableApplied } from "../hooks/usePayableApplied";
import { type PayableType } from "../types";

/**
 * Applied-payments drill-in (spec §5/§9; FR-PAY-007/-017). Lists posted, non-reversed
 * payments allocated to one payable, each opening the Payment viewer at
 * `/payments/[id]/view`. Rendered inline as an expanded row body — kept compact so it
 * fits under the parent grid.
 */
export function AppliedPaymentsDrillIn({
  payableType,
  payableId,
}: {
  payableType: PayableType;
  payableId: string;
}) {
  const query = usePayableApplied(payableType, payableId);
  if (query.isLoading) {
    return (
      <div
        className="border-t border-border bg-surface-2 px-6 py-4 text-[12.5px] text-muted-foreground"
        data-testid="payment-drill-in-loading"
      >
        <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading applied payments…
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="border-t border-border bg-surface-2 p-4" data-testid="payment-drill-in-error">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load applied payments."
          action={
            <Button size="sm" onClick={() => query.refetch()} data-testid="payment-drill-in-retry">
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  const data = query.data;
  if (!data) return null;
  const rows = data.applications;
  return (
    <div className="border-t border-border bg-surface-2 px-4 py-4" data-testid={`payment-drill-in-${payableId}`}>
      <div className="mb-3 flex items-baseline gap-4 text-[12px] text-muted-foreground">
        <span>Original <strong className="font-mono tabular-nums text-foreground">{formatMoney(data.originalAmount)}</strong></span>
        <span>Applied <strong className="font-mono tabular-nums text-foreground">{formatMoney(data.appliedAmount)}</strong></span>
        <span>Outstanding <strong className="font-mono tabular-nums text-foreground">{formatMoney(data.remainingOutstanding)}</strong></span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground" data-testid="payment-drill-in-empty">
          No posted payments applied yet.
        </p>
      ) : (
        <div className="grid grid-cols-[1fr_0.9fr_1fr_0.7fr] gap-2 text-[12.5px]">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Payment</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Date</span>
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Amount applied</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Status</span>
          {rows.map((a) => (
            <div key={a.paymentId} className="col-span-4 grid grid-cols-[1fr_0.9fr_1fr_0.7fr] items-center gap-2 border-t border-border py-2">
              <Link
                href={`/payments/${a.paymentId}/view`}
                className="font-mono font-semibold text-accent-ink hover:underline"
                data-testid={`payment-drill-in-link-${a.paymentId}`}
              >
                {a.entryNo}
              </Link>
              <span className="font-mono text-muted-foreground">{formatDate(a.paymentDate)}</span>
              <span className="text-right font-mono tabular-nums text-foreground">{formatMoney(a.amountAllocated)}</span>
              <span><PaymentStatusBadge status={a.status} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
