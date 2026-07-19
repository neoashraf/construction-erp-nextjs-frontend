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
  reference,
}: {
  payableType: PayableType;
  payableId: string;
  reference?: string;
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
  const money = (v: string) => formatMoney(v, { fractionDigits: 2 });
  const DRILL_GRID = "1fr 0.9fr 1fr 0.7fr";
  return (
    <div className="border-t border-border bg-surface-2 px-4 py-4" data-testid={`payment-drill-in-${payableId}`}>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        Applied payments
        <span className="ml-1.5 font-normal normal-case tracking-normal text-faint">
          posted &amp; non-reversed allocations against {reference ?? "this payable"}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground" data-testid="payment-drill-in-empty">
          No posted payments applied yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-token border border-border bg-surface">
          <div className="grid gap-2 border-b border-border bg-surface-2 px-3 py-2" style={{ gridTemplateColumns: DRILL_GRID }}>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Payment</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Date</span>
            <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Amount applied</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Status</span>
          </div>
          {rows.map((a) => (
            <div
              key={a.paymentId}
              className="grid items-center gap-2 border-b border-border px-3 py-2.5 text-[12.5px]"
              style={{ gridTemplateColumns: DRILL_GRID }}
            >
              <Link
                href={`/payments/${a.paymentId}/view`}
                className="font-mono font-semibold text-accent-ink hover:underline"
                data-testid={`payment-drill-in-link-${a.paymentId}`}
              >
                {a.entryNo}
              </Link>
              <span className="font-mono text-muted-foreground">{formatDate(a.paymentDate)}</span>
              <span className="text-right font-mono tabular-nums text-foreground">{money(a.amountAllocated)}</span>
              <span><PaymentStatusBadge status={a.status} /></span>
            </div>
          ))}
          <div
            className="grid items-center gap-2 bg-surface-2 px-3 py-2.5 text-[12.5px]"
            style={{ gridTemplateColumns: DRILL_GRID }}
            data-testid="payment-drill-in-total"
          >
            <span className="font-semibold text-foreground">Total applied</span>
            <span />
            <span className="text-right font-mono font-bold tabular-nums text-foreground">{money(data.appliedAmount)}</span>
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
