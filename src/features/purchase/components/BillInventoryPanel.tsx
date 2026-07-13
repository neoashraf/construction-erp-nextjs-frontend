"use client";

import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type PurchaseBillLine } from "../types";

/**
 * Bill-viewer inventory-movements panel (brief §Scope 9). Derived read-only from the
 * bill's stock lines — each stock line drove one `receiveIn` movement into the
 * receiving godown at post time (FR-PUR-011). Non-stock lines don't appear here.
 * The FE never asserts stock balance; it just displays what was received into which
 * godown. Zero stock lines → the empty state (spec §6 partial-state pattern).
 */
export function BillInventoryPanel({
  lines,
  className,
}: {
  lines: PurchaseBillLine[];
  className?: string;
}) {
  const stockLines = lines.filter((l) => l.isStockLine);

  return (
    <Card className={cn("p-4", className)} data-testid="bill-inventory-panel">
      <div className="flex items-center gap-2">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-token bg-accent-soft text-accent-ink">
          <Package className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Inventory movements
          </div>
          <div className="text-[13.5px] font-semibold text-foreground">Received-in on post</div>
        </div>
      </div>

      {stockLines.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-faint">This bill has no stock lines — no inventory moved.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="grid grid-cols-[50px_1fr_100px_90px] border-b border-border-strong bg-surface-2">
            <Header>Line</Header>
            <Header>Item · Godown</Header>
            <Header align="right">Received qty</Header>
            <Header align="right">Billed qty</Header>
          </div>
          {stockLines.map((l) => (
            <div
              key={`${l.lineNo}-${l.itemId}`}
              className="grid grid-cols-[50px_1fr_100px_90px] border-t border-muted"
              data-testid={`bill-inv-row-${l.lineNo}`}
            >
              <div className="px-4 py-2.5 text-[13px] tabular-nums text-faint">{l.lineNo}</div>
              <div className="min-w-0 px-4 py-2.5 text-[12.5px] text-foreground [overflow-wrap:anywhere]">
                {l.itemId} <span className="text-faint">·</span> {l.godownId}
              </div>
              <div className="px-4 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                {l.receivedQty ?? "—"}
              </div>
              <div className="px-4 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {l.billedQty}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Header({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      className={cn(
        "px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {children}
    </div>
  );
}
