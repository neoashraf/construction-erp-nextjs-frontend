"use client";

import Link from "next/link";
import { MatchStatusBadge } from "./MatchStatusBadge";
import { type ItemOption, type MatchLine } from "../types";

/**
 * PO → Bill → GRN match table (brief §Scope 8; spec §5). Read-only, per PO line:
 * Line · Item · Ordered · Billed · Received · Open · Match status. Quantities
 * right-aligned + tabular. Drill-down links route to the contributing PO / bill /
 * GRN — see route in the container. Below lg: stacked per-line cards for the rare
 * back-office tablet review (match view is desktop/tablet-only per spec §4).
 */
export function MatchTable({
  lines,
  items,
  poId,
}: {
  lines: MatchLine[];
  items: Map<string, ItemOption>;
  poId: string;
}) {
  return (
    <div data-testid="match-table">
      <div className="hidden overflow-x-auto lg:block">
        <div
          className="grid gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          role="row"
          style={{ gridTemplateColumns: "50px minmax(200px,1.4fr) 100px 100px 100px 100px 130px 90px" }}
        >
          <div className="py-3">Line</div>
          <div className="py-3">Item</div>
          <div className="py-3 text-right">Ordered</div>
          <div className="py-3 text-right">Billed</div>
          <div className="py-3 text-right">Received</div>
          <div className="py-3 text-right">Open</div>
          <div className="py-3">Match status</div>
          <div className="py-3 text-right">Drill down</div>
        </div>
        {lines.map((l) => (
          <div
            key={l.lineNo}
            role="row"
            className="grid items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
            style={{ gridTemplateColumns: "50px minmax(200px,1.4fr) 100px 100px 100px 100px 130px 90px" }}
            data-testid={`match-row-${l.lineNo}`}
          >
            <div className="py-3 font-mono text-[12.5px] tabular-nums text-muted-foreground">
              {l.lineNo}
            </div>
            <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">
              {items.get(l.itemId)?.name ?? (
                <>
                  <span className="font-mono">{l.itemId}</span>{" "}
                  <span className="text-faint">(name unavailable)</span>
                </>
              )}
            </div>
            <div className="py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
              {l.orderedQty}
            </div>
            <div className="py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
              {l.billedQty}
            </div>
            <div className="py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
              {l.receivedQty}
            </div>
            <div className="py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
              {l.openQty}
            </div>
            <div className="py-3">
              <MatchStatusBadge status={l.matchStatus} />
            </div>
            <div className="py-3 text-right text-[12px]">
              <Link
                href={`/purchase/orders/${poId}`}
                className="text-accent-ink hover:underline"
                data-testid={`match-drill-po-${l.lineNo}`}
              >
                Open PO
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Below lg — stacked cards (back-office reference use) */}
      <div className="flex flex-col gap-2 lg:hidden">
        {lines.map((l) => (
          <div
            key={l.lineNo}
            className="rounded-card border border-border bg-surface px-4 py-3"
            data-testid={`match-card-${l.lineNo}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12.5px] text-muted-foreground">Line {l.lineNo}</div>
                <div className="text-[14px] font-semibold text-foreground [overflow-wrap:anywhere]">
                  {items.get(l.itemId)?.name ?? l.itemId}
                </div>
              </div>
              <MatchStatusBadge status={l.matchStatus} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-[12.5px] font-mono tabular-nums">
              <Cell label="Ordered" value={l.orderedQty} />
              <Cell label="Billed" value={l.billedQty} />
              <Cell label="Received" value={l.receivedQty} />
              <Cell label="Open" value={l.openQty} bold />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <dt className="font-sans text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd className={bold ? "font-semibold text-foreground" : "text-foreground"}>{value}</dd>
    </div>
  );
}
