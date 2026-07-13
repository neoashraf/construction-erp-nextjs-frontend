"use client";

import { useMemo } from "react";
import { ChevronRight, Warehouse, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty } from "@/lib/money";
import { type LedgerGroupBy } from "../schemas/stock-ledger.schema";
import { type GodownOption, type ItemOption, type StockLedgerRow } from "../types";

/** id → display maps the screen passes down (Bangla-safe, never clipped). */
export interface LedgerNameMaps {
  godowns: Map<string, GodownOption>;
  items: Map<string, ItemOption>;
}

const GRID = "minmax(150px,1.3fr) minmax(160px,1.5fr) 150px 150px 130px 130px";
const NUM = "whitespace-nowrap font-mono text-[13px] tabular-nums";

function godownLabel(maps: LedgerNameMaps, id: string): { code: string; name: string } {
  const g = maps.godowns.get(id);
  return { code: g?.code ?? id.slice(0, 8), name: g?.name ?? "" };
}
function itemLabel(maps: LedgerNameMaps, id: string): { name: string; code: string; uom: string } {
  const i = maps.items.get(id);
  return { name: i?.name ?? id.slice(0, 8), code: i?.code ?? "", uom: i?.uom ?? "" };
}

interface Group {
  key: string;
  heading: string;
  sub: string;
  count: number;
  icon: "godown" | "item";
  rows: StockLedgerRow[];
}

/**
 * Stock-ledger balances table (spec §4.A). Grouped by godown or by item (client-side
 * re-sort of the same payload). Full grid at ≥lg; stacked cards below lg with the
 * quantity-on-hand rendered large — the number a Store Keeper needs fastest at the site
 * godown (spec §4.A, overview §9). Weighted-avg rate is "—" at zero on hand (never ৳0.0000).
 * No write affordance anywhere — the only row action is "View movements".
 */
export function StockBalancesTable({
  rows,
  maps,
  groupBy,
  asOfLabel,
  onView,
}: {
  rows: StockLedgerRow[];
  maps: LedgerNameMaps;
  groupBy: LedgerGroupBy;
  asOfLabel: string;
  onView: (row: StockLedgerRow) => void;
}) {
  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, StockLedgerRow[]>();
    for (const r of rows) {
      const key = groupBy === "godown" ? r.godownId : r.itemId;
      const arr = byKey.get(key) ?? [];
      arr.push(r);
      byKey.set(key, arr);
    }
    return Array.from(byKey.entries()).map(([key, groupRows]) => {
      if (groupBy === "godown") {
        const g = godownLabel(maps, key);
        return {
          key,
          heading: `${g.code} — ${g.name}`,
          sub: `${groupRows.length} item${groupRows.length === 1 ? "" : "s"}`,
          count: groupRows.length,
          icon: "godown" as const,
          rows: groupRows,
        };
      }
      const it = itemLabel(maps, key);
      return {
        key,
        heading: it.name,
        sub: `${groupRows.length} godown${groupRows.length === 1 ? "" : "s"}`,
        count: groupRows.length,
        icon: "item" as const,
        rows: groupRows,
      };
    });
  }, [rows, groupBy, maps]);

  return (
    <div data-testid="sl-balances">
      {/* ≥lg full grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 900 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">Godown</div>
            <div className="py-3">Item</div>
            <div className="py-3 text-right">Quantity on hand</div>
            <div className="py-3 text-right">Total value ৳</div>
            <div className="py-3 text-right">Wt-avg rate ৳</div>
            <div className="py-3" />
          </div>

          {groups.map((group) => (
            <div key={group.key}>
              <GroupHeader group={group} />
              {group.rows.map((r) => {
                const g = godownLabel(maps, r.godownId);
                const it = itemLabel(maps, r.itemId);
                const zero = r.weightedAverageRate === null;
                return (
                  <div
                    key={`${r.godownId}:${r.itemId}`}
                    role="row"
                    data-testid="sl-row"
                    className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
                    style={{ gridTemplateColumns: GRID }}
                    onClick={() => onView(r)}
                  >
                    <div className="py-3 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">{g.name || g.code}</div>
                    <div className="min-w-0 py-3">
                      <div className="font-semibold text-accent-ink [overflow-wrap:anywhere]">{it.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {it.code}
                        {it.uom ? ` · ${it.uom}` : ""}
                      </div>
                    </div>
                    <div className={cn("py-3 text-right text-foreground", NUM)}>
                      {formatQty(r.quantityOnHand, 4)} <span className="text-[11px] text-faint">{it.uom}</span>
                    </div>
                    <div className={cn("py-3 text-right font-medium text-foreground", NUM)}>{formatMoney(r.totalValue)}</div>
                    <div className={cn("py-3 text-right", NUM, zero ? "text-faint" : "text-muted-foreground")}>
                      {zero ? (
                        <span title="No rate — nothing on hand." aria-label="No rate — nothing on hand.">
                          —
                        </span>
                      ) : (
                        formatMoney(r.weightedAverageRate as string)
                      )}
                    </div>
                    <div className="flex justify-end py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onView(r)}
                        data-testid="sl-view"
                        className="inline-flex h-8 items-center gap-1 rounded-token border border-border-strong px-3 text-[12.5px] font-semibold text-foreground hover:bg-muted"
                      >
                        View movements
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* <lg site-facing cards — quantity prominent */}
      <div className="lg:hidden">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2 text-[12px] font-semibold text-foreground">
              {group.icon === "godown" ? (
                <Warehouse className="h-3.5 w-3.5 text-faint" aria-hidden />
              ) : (
                <Package className="h-3.5 w-3.5 text-faint" aria-hidden />
              )}
              <span className="[overflow-wrap:anywhere]">{group.heading}</span>
              <span className="text-faint">· {group.sub}</span>
            </div>
            {group.rows.map((r) => {
              const g = godownLabel(maps, r.godownId);
              const it = itemLabel(maps, r.itemId);
              const zero = r.weightedAverageRate === null;
              return (
                <button
                  key={`${r.godownId}:${r.itemId}`}
                  type="button"
                  data-testid="sl-card"
                  onClick={() => onView(r)}
                  className="flex w-full items-center gap-3 border-b border-muted px-4 py-3 text-left hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-accent-ink [overflow-wrap:anywhere]">{it.name}</div>
                    <div className="text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{g.name || g.code}</div>
                    <div className={cn("mt-1 text-[12px]", NUM, "text-muted-foreground")}>
                      {formatMoney(r.totalValue)} ·{" "}
                      {zero ? (
                        <span aria-label="No rate — nothing on hand.">—/{it.uom}</span>
                      ) : (
                        <>
                          {formatMoney(r.weightedAverageRate as string, { withSymbol: false })}/{it.uom}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div className={cn("text-[19px] font-semibold text-foreground", NUM)} data-testid="sl-card-qty">
                      {formatQty(r.quantityOnHand, 4)}
                    </div>
                    <div className="text-[11px] text-faint">{it.uom} on hand</div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-none text-faint" aria-hidden />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="sr-only" data-testid="sl-asof">
        Balances as of {asOfLabel}
      </p>
    </div>
  );
}

function GroupHeader({ group }: { group: Group }) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2 text-[12px] font-semibold text-foreground">
      {group.icon === "godown" ? (
        <Warehouse className="h-3.5 w-3.5 text-faint" aria-hidden />
      ) : (
        <Package className="h-3.5 w-3.5 text-faint" aria-hidden />
      )}
      <span className="[overflow-wrap:anywhere]">{group.heading}</span>
      <span className="text-faint">· {group.sub}</span>
    </div>
  );
}
