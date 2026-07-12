"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty, toDecimal } from "@/lib/money";
import { type ItemOption, type RequisitionOutstanding } from "../types";

/**
 * (B) Outstanding-balance view (spec §5B; FR-REQ-018/-021). Per-line requested/issued/balance
 * (UoM-qualified) + the informational total indicative value; refreshes after each issue. The
 * Manual Close action shows only when the requisition is still `APPROVED`/`PARTIALLY_ISSUED`
 * with a positive balance and the viewer may close (spec §11) — hidden once `ISSUED`.
 */
const NUM = "whitespace-nowrap font-mono text-[13px] tabular-nums";

export function OutstandingBalanceView({
  outstanding,
  items,
  canClose,
  onManualClose,
}: {
  outstanding: RequisitionOutstanding;
  items: Map<string, ItemOption>;
  canClose: boolean;
  onManualClose: () => void;
}) {
  const totalBalance = outstanding.lines.reduce(
    (acc, l) => acc.plus(toDecimal(l.balanceQuantity)),
    toDecimal("0"),
  );
  const closable =
    (outstanding.status === "APPROVED" || outstanding.status === "PARTIALLY_ISSUED") &&
    totalBalance.gt(0);

  return (
    <Card className="flex flex-col overflow-hidden" data-testid="req-outstanding">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span
          className="grid h-6 w-6 flex-none place-items-center rounded-token bg-primary text-[11px] font-bold text-primary-foreground"
          aria-hidden
        >
          B
        </span>
        <h2 className="text-sm font-bold text-foreground">Outstanding balance</h2>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 460 }}>
          <div
            role="row"
            className="grid grid-cols-[minmax(120px,1.4fr)_90px_90px_100px_64px] items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          >
            <div className="py-2.5">Item</div>
            <div className="py-2.5 text-right">Requested</div>
            <div className="py-2.5 text-right">Issued</div>
            <div className="py-2.5 text-right">Balance</div>
            <div className="py-2.5">UoM</div>
          </div>
          {outstanding.lines.map((l) => {
            const item = items.get(l.itemId);
            const bal = toDecimal(l.balanceQuantity);
            return (
              <div
                key={l.requisitionLineId}
                role="row"
                className="grid grid-cols-[minmax(120px,1.4fr)_90px_90px_100px_64px] items-center gap-2 border-b border-muted px-4"
              >
                <div className="min-w-0 truncate py-2.5 text-[13px]" title={item?.name}>
                  {item?.name ?? l.itemId.slice(0, 8)}
                </div>
                <div className={cn("py-2.5 text-right text-muted-foreground", NUM)}>
                  {formatQty(l.requestedQuantity, 4)}
                </div>
                <div className={cn("py-2.5 text-right text-muted-foreground", NUM)}>
                  {formatQty(l.issuedQuantity, 4)}
                </div>
                <div
                  className={cn(
                    "py-2.5 text-right font-semibold",
                    NUM,
                    bal.gt(0) ? "text-warning-ink" : "text-success-ink",
                  )}
                >
                  {formatQty(l.balanceQuantity, 4)}
                </div>
                <div className="py-2.5 text-[12px] text-faint">{l.uom}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Total outstanding{" "}
            <span className="font-normal normal-case tracking-normal text-faint">(indicative)</span>
          </div>
          <div
            className="mt-0.5 font-mono text-[17px] font-bold tabular-nums text-foreground"
            data-testid="req-outstanding-total"
          >
            {formatMoney(outstanding.totalOutstandingValueIndicative)}
          </div>
        </div>
        {canClose && closable && (
          <Button
            variant="outline"
            size="md"
            onClick={onManualClose}
            data-testid="req-manual-close"
          >
            Manual close
          </Button>
        )}
      </div>
    </Card>
  );
}
