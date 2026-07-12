"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { SourceLink } from "./SourceLink";
import { type StockMovement } from "../types";

/** Shared grid template for the ≥lg movement table (widths from the design drawer). */
export const MOVEMENT_GRID =
  "96px 52px 84px 78px 86px 80px 94px 80px minmax(140px,1fr)";

const NUM = "font-mono text-[11.5px] tabular-nums";

/** IN = success, OUT = warning; a dot + text label (never colour alone, spec §10). */
function DirectionBadge({ direction }: { direction: StockMovement["direction"] }) {
  const isIn = direction === "IN";
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-pill px-1.5 text-[10px] font-bold",
        isIn ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", isIn ? "bg-success" : "bg-warning")} />
      {direction}
    </span>
  );
}

/** One movement as a ≥lg grid row (full running-balance columns visible). */
export function MovementGridRow({ m, uom }: { m: StockMovement; uom: string }) {
  return (
    <div
      role="row"
      data-testid="sl-mv-row"
      className="grid items-center gap-2 border-b border-muted px-5 py-2.5 hover:bg-surface-2"
      style={{ gridTemplateColumns: MOVEMENT_GRID }}
    >
      <div className={cn(NUM, "text-muted-foreground")}>{formatDate(m.voucherDate)}</div>
      <div>
        <DirectionBadge direction={m.direction} />
      </div>
      <div className={cn(NUM, "text-right text-foreground")}>
        {formatQty(m.quantity, 4)} <span className="text-[10px] text-faint">{uom}</span>
      </div>
      <div className={cn(NUM, "text-right text-muted-foreground")}>{formatMoney(m.rate, { withSymbol: false })}</div>
      <div className={cn(NUM, "text-right font-medium text-foreground")}>{formatMoney(m.value, { withSymbol: false })}</div>
      <div className={cn(NUM, "text-right text-muted-foreground")}>{formatQty(m.balanceQtyAfter, 4)}</div>
      <div className={cn(NUM, "text-right text-muted-foreground")}>{formatMoney(m.balanceValueAfter, { withSymbol: false })}</div>
      <div className={cn(NUM, "text-right text-muted-foreground")}>{formatMoney(m.avgRateAfter, { withSymbol: false })}</div>
      <div className="min-w-0">
        <SourceLink sourceType={m.sourceType} sourceId={m.sourceId} isReversal={m.isReversal} />
      </div>
    </div>
  );
}

/** One movement as a <lg card — running balance behind a per-row expander (spec §4.B). */
export function MovementCard({ m, uom }: { m: StockMovement; uom: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="sl-mv-card" className="border-b border-muted px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(NUM, "text-[12px] text-muted-foreground")}>{formatDate(m.voucherDate)}</span>
        <DirectionBadge direction={m.direction} />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className={cn(NUM, "text-[13px] text-foreground")}>
          {formatQty(m.quantity, 4)} <span className="text-faint">{uom}</span>
        </span>
        <span className={cn(NUM, "text-[13px] font-medium text-foreground")}>{formatMoney(m.value)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <SourceLink sourceType={m.sourceType} sourceId={m.sourceId} isReversal={m.isReversal} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-token border border-border-strong px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          data-testid="sl-mv-runbalance"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} aria-hidden />
          Running balance
        </button>
      </div>
      {open && (
        <dl className="mt-2 space-y-1 rounded-token bg-surface-2 p-2.5 text-[11.5px]">
          <Line label="Rate" value={formatMoney(m.rate)} />
          <Line label="Balance qty after" value={`${formatQty(m.balanceQtyAfter, 4)} ${uom}`} />
          <Line label="Balance value after" value={formatMoney(m.balanceValueAfter)} />
          <Line label="Avg rate after" value={formatMoney(m.avgRateAfter)} />
        </dl>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="font-mono tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
