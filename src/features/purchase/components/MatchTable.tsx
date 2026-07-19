"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronsUpDown } from "lucide-react";
import { formatQty } from "@/lib/money";
import { MatchStatusBadge } from "./MatchStatusBadge";
import { type ItemOption, type MatchLine } from "../types";

/**
 * PO → Bill → GRN match table (brief §Scope 8; spec §5). Read-only, per PO line:
 * Line · Item · Ordered · Billed · Received · Open · Match status. Quantities
 * right-aligned + tabular, 3-dec. The Open column is coloured by sign (positive =
 * still owing, negative = over). Drill-down links route to the contributing bill /
 * GRN per line — `null` refs render a muted "No bill / No GRN" fallback until the
 * backend surfaces them. Below lg: stacked per-line cards for the rare back-office
 * tablet review (match view is desktop/tablet-only per spec §4).
 */
const GRID_COLS = "50px minmax(200px,1.4fr) 100px 100px 100px 100px 130px 90px";

/** Sign-based tone for the Open column: owing (positive) · over (negative) · settled (zero). */
function openTone(openQty: string): string {
  const n = Number(openQty);
  if (!Number.isFinite(n) || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-success-ink" : "text-destructive-ink";
}

export function MatchTable({
  lines,
  items,
}: {
  lines: MatchLine[];
  items: Map<string, ItemOption>;
}) {
  return (
    <div data-testid="match-table">
      <div className="hidden overflow-x-auto lg:block">
        <div
          className="grid gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          role="row"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="flex items-center gap-1 py-3">
            Line
            <ChevronsUpDown className="h-3 w-3 text-faint" aria-hidden />
          </div>
          <div className="flex items-center gap-1 py-3">
            Item
            <ChevronsUpDown className="h-3 w-3 text-faint" aria-hidden />
          </div>
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
            style={{ gridTemplateColumns: GRID_COLS }}
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
              {formatQty(l.orderedQty)}
            </div>
            <div className="py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
              {formatQty(l.billedQty)}
            </div>
            <div className="py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
              {formatQty(l.receivedQty)}
            </div>
            <div
              className={`py-3 text-right font-mono text-[13px] font-semibold tabular-nums ${openTone(l.openQty)}`}
            >
              {formatQty(l.openQty)}
            </div>
            <div className="py-3">
              <MatchStatusBadge status={l.matchStatus} />
            </div>
            <div className="flex flex-col items-end gap-0.5 py-3 text-[12px]">
              {l.billRef || l.grnRef ? (
                <>
                  {l.billRef ? (
                    <Link
                      href={`/purchase/bills/${l.billId}`}
                      className="inline-flex items-center gap-0.5 text-accent-ink hover:underline"
                      data-testid={`match-drill-bill-${l.lineNo}`}
                    >
                      Bill {l.billRef}
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </Link>
                  ) : null}
                  {l.grnRef ? (
                    <Link
                      href={`/purchase/grn/${l.grnId}`}
                      className="inline-flex items-center gap-0.5 text-accent-ink hover:underline"
                      data-testid={`match-drill-grn-${l.lineNo}`}
                    >
                      GRN {l.grnRef}
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </Link>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground" data-testid={`match-drill-none-${l.lineNo}`}>
                  No bill / No GRN
                </span>
              )}
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
              <Cell label="Ordered" value={formatQty(l.orderedQty)} />
              <Cell label="Billed" value={formatQty(l.billedQty)} />
              <Cell label="Received" value={formatQty(l.receivedQty)} />
              <Cell label="Open" value={formatQty(l.openQty)} className={openTone(l.openQty)} />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="font-sans text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd className={className ? `font-semibold ${className}` : "text-foreground"}>{value}</dd>
    </div>
  );
}
