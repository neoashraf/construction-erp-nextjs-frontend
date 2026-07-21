"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatQty } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MatchStatusBadge } from "./MatchStatusBadge";
import { type ItemOption, type MatchLine, type PurchaseMatchStatus } from "../types";

/**
 * PO → Bill → GRN match table (brief §Scope 8; spec §5). Read-only, per PO line:
 * Line · Item · Ordered · Billed · Received · Open · Match status · Drill-down.
 * Quantities right-aligned + tabular, 3-dec. Ordered/Billed read muted (reference),
 * Received bold (what actually arrived); the Open column is toned by the line's
 * match status — Matched (settled) green, Over-received blue, Under-received /
 * Pending amber — matching the "GRN and matching.dc.html" PO/Bill-match artboard.
 * Line + Item headers are click-to-sort (asc → desc → unsorted; Line ascending by
 * default), same caret convention as the Purchase Bill / PO lists. Drill-down links
 * route to the contributing bill / GRN per line, left-aligned; `null` refs render a
 * muted two-line "No bill / No GRN" fallback until the backend surfaces them. Below
 * lg: stacked per-line cards for the rare back-office tablet review (match view is
 * desktop/tablet-only per spec §4).
 */
const GRID_COLS = "48px minmax(180px,1.4fr) 96px 96px 96px 96px 150px minmax(150px,max-content)";

type MatchSortKey = "lineNo" | "item";
type SortDirection = "asc" | "desc";
interface MatchSortState {
  key: MatchSortKey;
  direction: SortDirection;
}

/** Open-column tone follows the line's advisory match status, not the raw sign. */
const OPEN_TONE: Record<PurchaseMatchStatus, string> = {
  MATCHED: "text-success-ink",
  OVER_RECEIVED: "text-info-ink",
  UNDER_RECEIVED: "text-warning-ink",
  PENDING_RECEIPT: "text-warning-ink",
};

/**
 * Clickable sort-caret header (design "GRN and matching.dc.html" PO/Bill-match table).
 * Sorting is client-side over the line set. Cycle: asc → desc → unsorted. Same
 * convention as the Purchase Bill / PO / receipts lists.
 */
function SortHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: MatchSortKey;
  sort: MatchSortState | null;
  onSort: (key: MatchSortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const sortedState = active
    ? sort.direction === "asc"
      ? "sorted ascending"
      : "sorted descending"
    : "not sorted";
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`${label}, ${sortedState}. Click to sort.`}
      data-testid={`match-sort-${sortKey}`}
      className="flex items-center gap-1.5"
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="flex shrink-0 flex-col text-[8px] leading-[0.6]" aria-hidden>
        <span className={active && sort.direction === "asc" ? "text-foreground" : "text-border-strong"}>
          ▲
        </span>
        <span className={active && sort.direction === "desc" ? "text-foreground" : "text-border-strong"}>
          ▼
        </span>
      </span>
    </button>
  );
}

export function MatchTable({
  lines,
  items,
}: {
  lines: MatchLine[];
  items: Map<string, ItemOption>;
}) {
  // Line ascending by default (design PO/Bill-match artboard shows LINE ▲ active).
  const [sort, setSort] = useState<MatchSortState | null>({ key: "lineNo", direction: "asc" });

  function handleSort(key: MatchSortKey) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  const sortedLines = useMemo(() => {
    if (!sort) return lines;
    const itemName = (l: MatchLine) => items.get(l.itemId)?.name ?? l.itemId;
    const sorted = [...lines].sort((a, b) =>
      sort.key === "lineNo"
        ? a.lineNo - b.lineNo
        : itemName(a).localeCompare(itemName(b)),
    );
    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [lines, sort, items]);

  return (
    <div data-testid="match-table">
      <div className="hidden overflow-x-auto lg:block">
        <div
          className="grid gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          role="row"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="flex items-center py-3">
            <SortHead label="Line" sortKey="lineNo" sort={sort} onSort={handleSort} />
          </div>
          <div className="flex items-center py-3">
            <SortHead label="Item" sortKey="item" sort={sort} onSort={handleSort} />
          </div>
          <div className="py-3 text-right">Ordered</div>
          <div className="py-3 text-right">Billed</div>
          <div className="py-3 text-right">Received</div>
          <div className="py-3 text-right">Open</div>
          <div className="py-3">Match status</div>
          <div className="py-3">Drill-down</div>
        </div>
        {sortedLines.map((l) => {
          const item = items.get(l.itemId);
          return (
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
                {item?.name ?? (
                  <>
                    <span className="font-mono">{l.itemId}</span>{" "}
                    <span className="text-faint">(name unavailable)</span>
                  </>
                )}
                {item?.uom ? (
                  <div className="mt-0.5 text-[11px] text-faint">Unit: {item.uom}</div>
                ) : null}
              </div>
              <div className="py-3 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                {formatQty(l.orderedQty)}
              </div>
              <div className="py-3 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                {formatQty(l.billedQty)}
              </div>
              <div className="py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                {formatQty(l.receivedQty)}
              </div>
              <div
                className={cn(
                  "py-3 text-right font-mono text-[13px] font-semibold tabular-nums",
                  OPEN_TONE[l.matchStatus],
                )}
              >
                {formatQty(l.openQty)}
              </div>
              <div className="py-3">
                <MatchStatusBadge status={l.matchStatus} />
              </div>
              <div className="flex flex-col items-start gap-0.5 py-3 text-[12px]">
                {l.billRef || l.grnRef ? (
                  <>
                    {l.billRef ? (
                      <Link
                        href={`/purchase/bills/${l.billId}`}
                        className="inline-flex items-center gap-0.5 whitespace-nowrap text-accent-ink hover:underline"
                        data-testid={`match-drill-bill-${l.lineNo}`}
                      >
                        Bill {l.billRef}
                        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                      </Link>
                    ) : null}
                    {l.grnRef ? (
                      <Link
                        href={`/purchase/grn/${l.grnId}`}
                        className="inline-flex items-center gap-0.5 whitespace-nowrap text-accent-ink hover:underline"
                        data-testid={`match-drill-grn-${l.lineNo}`}
                      >
                        GRN {l.grnRef}
                        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <span
                    className="flex flex-col text-muted-foreground"
                    data-testid={`match-drill-none-${l.lineNo}`}
                  >
                    <span>No bill</span>
                    <span>No GRN</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Below lg — stacked cards (back-office reference use) */}
      <div className="flex flex-col gap-2 lg:hidden">
        {sortedLines.map((l) => (
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
                {items.get(l.itemId)?.uom ? (
                  <div className="mt-0.5 text-[11px] text-faint">
                    Unit: {items.get(l.itemId)!.uom}
                  </div>
                ) : null}
              </div>
              <MatchStatusBadge status={l.matchStatus} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-[12.5px] font-mono tabular-nums">
              <Cell label="Ordered" value={formatQty(l.orderedQty)} muted />
              <Cell label="Billed" value={formatQty(l.billedQty)} muted />
              <Cell label="Received" value={formatQty(l.receivedQty)} />
              <Cell label="Open" value={formatQty(l.openQty)} className={OPEN_TONE[l.matchStatus]} />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  className,
  muted,
}: {
  label: string;
  value: string;
  className?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="font-sans text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd
        className={cn(
          className ? `font-semibold ${className}` : muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
