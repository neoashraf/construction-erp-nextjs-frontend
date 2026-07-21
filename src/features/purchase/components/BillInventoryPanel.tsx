"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toDecimal } from "@/lib/money";
import { money, qty } from "../format";
import { type PurchaseBillLine } from "../types";

/** Movement value = receivedQty (falling back to billedQty) × rate — derived on the FE. */
function movementValue(l: PurchaseBillLine): string {
  const qty = l.receivedQty && Number(l.receivedQty) > 0 ? l.receivedQty : l.billedQty;
  return toDecimal(qty || "0").times(toDecimal(l.rate || "0")).toFixed(4);
}

/** ID → display resolvers for the movement rows, supplied by the viewer. */
export interface InventoryResolve {
  godown: (id: string | null) => string | null;
  item: (id: string | null) => string | null;
}

/**
 * Bill-viewer inventory-movements panel (brief §Scope 9; Purchase Bill.dc.html viewer). Derived
 * read-only from the bill's stock lines — each stock line drove one `receiveIn` movement into the
 * receiving godown at post time (FR-PUR-011). Non-stock lines carry no inventory movement and are
 * called out in the footer note. The FE never asserts stock balance; it displays what was received
 * into which godown, with a teal card icon + `receiveIn` subtitle matching the design.
 */
export function BillInventoryPanel({
  lines,
  resolve,
  className,
}: {
  lines: PurchaseBillLine[];
  resolve: InventoryResolve;
  className?: string;
}) {
  const stockLines = lines.filter((l) => l.isStockLine);
  const serviceLine = lines.find((l) => !l.isStockLine);
  const serviceName = serviceLine
    ? resolve.item(serviceLine.itemId) ?? serviceLine.expenseAccountId ?? "Service line"
    : null;

  return (
    <Card className={cn("overflow-hidden p-0", className)} data-testid="bill-inventory-panel">
      <div className="flex items-center gap-2 border-b border-border px-4 py-[13px]">
        <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[7px] bg-teal-soft text-teal-ink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 8l-9-5-9 5 9 5 9-5z" />
            <path d="M3 8v8l9 5 9-5V8" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold text-foreground">Inventory movements</span>
        <span className="text-[12px] text-faint">receiveIn</span>
      </div>

      {stockLines.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-faint">
          {serviceName
            ? `Service line “${serviceName}” carries no inventory movement.`
            : "This bill has no stock lines — nothing was received into a godown."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[1.4fr_1.4fr_96px_120px] border-b border-border-strong bg-surface-2">
              <Header>Godown</Header>
              <Header>Item</Header>
              <Header align="right">Qty in</Header>
              <Header align="right">Value ৳</Header>
            </div>
            {stockLines.map((l) => (
              <div
                key={`${l.lineNo}-${l.itemId}`}
                className="grid min-h-[48px] grid-cols-[1.4fr_1.4fr_96px_120px] items-center"
                data-testid={`bill-inv-row-${l.lineNo}`}
              >
                <div className="min-w-0 px-[14px] py-[11px] text-[12.5px] text-foreground [overflow-wrap:anywhere]">
                  {resolve.godown(l.godownId) ?? l.godownId}
                </div>
                <div className="min-w-0 px-3 py-[11px] text-[12.5px] text-foreground [overflow-wrap:anywhere]">
                  {resolve.item(l.itemId) ?? l.itemId}
                </div>
                <div className="px-3 py-[11px] text-right font-mono text-[12.5px] font-semibold tabular-nums text-success-ink">
                  +{qty(l.receivedQty ?? l.billedQty)}
                </div>
                <div className="px-[14px] py-[11px] text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {money(movementValue(l))}
                </div>
              </div>
            ))}
          </div>
          {serviceName && (
            <p className="border-t border-border bg-surface-2 px-[14px] py-2.5 text-[11.5px] text-muted-foreground">
              Service line “{serviceName}” carries no inventory movement.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function Header({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      className={cn(
        "px-[14px] py-[9px] text-[10px] font-semibold uppercase tracking-[0.3px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {children}
    </div>
  );
}
