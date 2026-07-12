"use client";

import { cn } from "@/lib/utils";
import { formatMoney, formatQty, toDecimal } from "@/lib/money";
import { type ItemOption, type RequisitionLine } from "../types";

/**
 * Read-only material-lines table (spec §5). Renders each line's item, requested/issued/
 * balance quantity, indicative rate and line value (`requestedQuantity × indicativeRate`,
 * "—" when the rate is unresolved). Shared by the read-only past-DRAFT entry form here and
 * by fe-requisition-approval / -issue. `showIssued` reveals the issued/balance columns for
 * the sibling screens; the entry form hides them (no issues yet).
 */
const NUM = "whitespace-nowrap font-mono text-[13px] tabular-nums";

function lineValue(l: RequisitionLine): string | null {
  if (l.indicativeRate == null) return null;
  return toDecimal(l.requestedQuantity).times(toDecimal(l.indicativeRate)).toFixed(4);
}

export function RequisitionLinesReadOnly({
  lines,
  items,
  showIssued = false,
}: {
  lines: RequisitionLine[];
  items: Map<string, ItemOption>;
  showIssued?: boolean;
}) {
  return (
    <div className="overflow-x-auto" data-testid="req-lines-readonly">
      <div style={{ minWidth: showIssued ? 720 : 560 }}>
        <div
          role="row"
          className={cn(
            "grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
            showIssued
              ? "grid-cols-[minmax(140px,1.6fr)_90px_90px_90px_110px_120px]"
              : "grid-cols-[minmax(160px,1.8fr)_110px_130px_130px]",
          )}
        >
          <div className="py-2.5">Item</div>
          <div className="py-2.5 text-right">Requested</div>
          {showIssued && <div className="py-2.5 text-right">Issued</div>}
          {showIssued && <div className="py-2.5 text-right">Balance</div>}
          <div className="py-2.5 text-right">Indic. rate ৳</div>
          <div className="py-2.5 text-right">Line value ৳</div>
        </div>
        {lines.map((l, i) => {
          const item = l.itemId ? items.get(l.itemId) : undefined;
          const uom = l.uom ?? item?.uom ?? "";
          const val = lineValue(l);
          return (
            <div
              key={l.id ?? i}
              role="row"
              className={cn(
                "grid items-center gap-2 border-b border-muted px-4",
                showIssued
                  ? "grid-cols-[minmax(140px,1.6fr)_90px_90px_90px_110px_120px]"
                  : "grid-cols-[minmax(160px,1.8fr)_110px_130px_130px]",
              )}
            >
              <div className="min-w-0 py-2.5 text-[13px] [overflow-wrap:anywhere]">
                {item?.name ?? l.itemId.slice(0, 8)}
              </div>
              <div className={cn("py-2.5 text-right", NUM)}>
                {formatQty(l.requestedQuantity, 4)} <span className="text-[11px] text-faint">{uom}</span>
              </div>
              {showIssued && (
                <div className={cn("py-2.5 text-right text-muted-foreground", NUM)}>
                  {l.issuedQuantity ? formatQty(l.issuedQuantity, 4) : "0.0000"}
                </div>
              )}
              {showIssued && (
                <div className={cn("py-2.5 text-right", NUM)}>
                  {l.balanceQuantity ? formatQty(l.balanceQuantity, 4) : "—"}
                </div>
              )}
              <div className={cn("py-2.5 text-right text-muted-foreground", NUM)}>
                {l.indicativeRate != null ? formatMoney(l.indicativeRate, { withSymbol: false }) : "—"}
              </div>
              <div className={cn("py-2.5 text-right font-medium text-foreground", NUM)}>
                {val != null ? formatMoney(val, { withSymbol: false }) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
