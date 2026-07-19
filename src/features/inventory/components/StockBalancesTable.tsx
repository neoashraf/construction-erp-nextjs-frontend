"use client";

import { useMemo } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty } from "@/lib/money";
import { type LedgerGroupBy } from "../schemas/stock-ledger.schema";
import { type GodownOption, type ItemOption, type StockLedgerRow } from "../types";

/** id → display maps the screen passes down (Bangla-safe, never clipped). */
export interface LedgerNameMaps {
  godowns: Map<string, GodownOption>;
  items: Map<string, ItemOption>;
}

/** Fixed pixel column widths (design desktop grid): Godown · Item · Qty · Total · Rate · View · kebab. */
const GRID = "190px minmax(180px,1fr) 150px 140px 130px 138px 46px";
const NUM = "whitespace-nowrap font-mono text-[12.5px] tabular-nums";

function godownLabel(maps: LedgerNameMaps, id: string): { code: string; name: string } {
  const g = maps.godowns.get(id);
  return { code: g?.code ?? id.slice(0, 8), name: g?.name ?? "" };
}
function itemLabel(maps: LedgerNameMaps, id: string): { name: string; code: string; uom: string } {
  const i = maps.items.get(id);
  return { name: i?.name ?? id.slice(0, 8), code: i?.code ?? "", uom: i?.uom ?? "" };
}

/**
 * A 2-glyph monogram for a godown chip. Prefers the first letters of the two most
 * meaningful word-segments (e.g. "Central Store — Tongi" → "CT", "G-Site-A" → "SA"),
 * falling back to the first two alphanumerics of the name/code.
 */
function chipGlyph(code: string, name: string): string {
  const source = name || code;
  const segments = source.split(/[^a-zA-Z0-9ঀ-৿]+/).filter(Boolean);
  // Prefer multi-char words (skip lone prefixes like "G"), take their initials.
  const rich = segments.filter((s) => s.length > 1);
  const pick = (rich.length >= 2 ? rich : segments).slice(0, 2);
  const mono = pick.map((s) => s[0]).join("");
  const glyph = mono.length >= 2 ? mono : source.replace(/[^a-zA-Z0-9ঀ-৿]/g, "").slice(0, 2);
  return glyph.toUpperCase();
}
/** Last two chars of an item code (design item-chip glyph). */
function itemChipGlyph(code: string, fallback: string): string {
  const src = code || fallback;
  return (src.slice(-2) || fallback.slice(0, 2)).toUpperCase();
}

interface Group {
  key: string;
  heading: string;
  sub: string;
  chip: string;
  icon: "godown" | "item";
  rows: StockLedgerRow[];
}

/**
 * Stock-ledger balances table (spec §4.A). Grouped by godown or by item (client-side
 * re-sort of the same payload). Full grid at ≥lg; stacked cards below lg with the
 * quantity-on-hand rendered large — the number a Store Keeper needs fastest at the site
 * godown (spec §4.A, overview §9). Weighted-avg rate is "—" at zero on hand (never ৳0.0000).
 * No write affordance anywhere — the row actions are read-only (View movements · Copy row).
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
          heading: g.name ? `${g.code} — ${g.name}` : g.code,
          sub: `${groupRows.length} item${groupRows.length === 1 ? "" : "s"}`,
          chip: chipGlyph(g.code, g.name),
          icon: "godown" as const,
          rows: groupRows,
        };
      }
      const it = itemLabel(maps, key);
      return {
        key,
        heading: it.name,
        sub: `${groupRows.length} godown${groupRows.length === 1 ? "" : "s"}${it.uom ? ` · unit: ${it.uom}` : ""}`,
        chip: itemChipGlyph(it.code, it.name),
        icon: "item" as const,
        rows: groupRows,
      };
    });
  }, [rows, groupBy, maps]);

  return (
    <div data-testid="sl-balances">
      {/* ≥lg full grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 924 }}>
          <div
            role="row"
            className="grid h-11 items-center border-b border-border-strong bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="pl-4">Godown</div>
            <div className="px-2.5">Item</div>
            <div className="px-2.5 text-right">Quantity on hand</div>
            <div className="px-2.5 text-right">Total value ৳</div>
            <div className="px-2.5 text-right">Wt-avg rate ৳</div>
            <div />
            <div />
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
                    className="grid min-h-[52px] cursor-pointer items-center border-b border-muted hover:bg-surface-2"
                    style={{ gridTemplateColumns: GRID }}
                    onClick={() => onView(r)}
                  >
                    <div className="py-2 pl-4 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                      {g.name || g.code}
                    </div>
                    <div className="min-w-0 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(r);
                        }}
                        data-testid="sl-item-link"
                        className="text-left text-[13.5px] font-semibold text-accent-ink hover:underline [overflow-wrap:anywhere]"
                      >
                        {it.name}
                      </button>
                      <div className="mt-0.5 text-[11.5px] text-faint">
                        {it.code}
                        {it.uom ? ` · ${it.uom}` : ""}
                      </div>
                    </div>
                    <div className={cn("px-2.5 text-right text-foreground", NUM)}>
                      {formatQty(r.quantityOnHand, 4)}{" "}
                      <span className="text-[11px] text-faint">{it.uom}</span>
                    </div>
                    <div className={cn("px-2.5 text-right font-medium text-foreground", NUM)}>
                      {formatMoney(r.totalValue)}
                    </div>
                    <div
                      className={cn(
                        "px-2.5 text-right",
                        NUM,
                        zero ? "text-faint" : "text-foreground",
                      )}
                    >
                      {zero ? (
                        <span
                          title="No rate — nothing on hand."
                          aria-label="No rate — nothing on hand."
                        >
                          —
                        </span>
                      ) : (
                        formatMoney(r.weightedAverageRate as string)
                      )}
                    </div>
                    <div className="flex justify-end px-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onView(r)}
                        data-testid="sl-view"
                        className="inline-flex h-[30px] items-center whitespace-nowrap rounded-token border border-border-strong bg-surface px-3 text-[12px] font-semibold text-foreground hover:bg-muted"
                      >
                        View movements
                      </button>
                    </div>
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Row actions"
                            data-testid="sl-row-kebab"
                            className="grid h-7 w-7 place-items-center rounded-token text-faint hover:bg-muted hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[176px]">
                          <DropdownMenuItem onSelect={() => onView(r)}>
                            View movements
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              void navigator.clipboard
                                ?.writeText(
                                  `${it.name} · ${g.name || g.code} · ${formatQty(r.quantityOnHand, 4)} ${it.uom}`,
                                )
                                .catch(() => {});
                            }}
                          >
                            Copy row
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* pagination footer (design) */}
          <div
            className="flex items-center justify-between gap-4 border-t border-border px-4 py-3"
            data-testid="sl-pagination"
          >
            <span className="text-[12.5px] text-muted-foreground">
              Showing 1–{rows.length} of {rows.length} · page size 25
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="h-[30px] rounded-token border border-border bg-surface-2 px-2.5 text-[12px] font-semibold text-faint"
              >
                ‹ Prev
              </button>
              <span className="inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-token bg-primary px-1 text-[12px] font-semibold text-primary-foreground">
                1
              </span>
              <button
                type="button"
                disabled
                className="h-[30px] rounded-token border border-border bg-surface-2 px-2.5 text-[12px] font-semibold text-faint"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* md–lg tablet folded table — Item·Godown / Qty / Value / Avg rate / › */}
      <div className="hidden md:block lg:hidden">
        <div
          className="grid h-10 items-center bg-surface-2 border-b border-border-strong text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          style={{ gridTemplateColumns: "minmax(0,1fr) 136px 124px 116px 38px" }}
        >
          <div className="pl-4 text-foreground">Item · Godown</div>
          <div className="px-2 text-right">Qty on hand</div>
          <div className="px-2 text-right">Value ৳</div>
          <div className="px-2 text-right">Avg rate ৳</div>
          <div />
        </div>
        {groups.map((group) => (
          <div key={group.key}>
            <div className="flex h-9 items-center gap-2 border-b border-muted bg-surface-2 px-4 text-[12px] font-semibold text-foreground">
              <span
                className={cn(
                  "grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] text-[8.5px] font-bold",
                  group.icon === "godown"
                    ? "bg-warning-soft text-warning-ink"
                    : "bg-info-soft text-info-ink",
                )}
                aria-hidden
              >
                {group.chip}
              </span>
              <span className="[overflow-wrap:anywhere]">{group.heading}</span>
              <span className="text-[11px] text-faint">· {group.sub}</span>
            </div>
            {group.rows.map((r) => {
              const g = godownLabel(maps, r.godownId);
              const it = itemLabel(maps, r.itemId);
              const zero = r.weightedAverageRate === null;
              return (
                <div
                  key={`${r.godownId}:${r.itemId}`}
                  role="row"
                  data-testid="sl-row-tablet"
                  className="grid min-h-[52px] cursor-pointer items-center border-b border-muted hover:bg-surface-2"
                  style={{ gridTemplateColumns: "minmax(0,1fr) 136px 124px 116px 38px" }}
                  onClick={() => onView(r)}
                >
                  <div className="min-w-0 py-2 pl-4 pr-2">
                    <div className="text-[12.5px] font-semibold text-accent-ink [overflow-wrap:anywhere]">
                      {it.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint [overflow-wrap:anywhere]">
                      {g.name || g.code}
                      {it.code ? ` · ${it.code}` : ""}
                    </div>
                  </div>
                  <div className={cn("px-2 text-right text-foreground", NUM, "text-[11.5px]")}>
                    {formatQty(r.quantityOnHand, 4)}{" "}
                    <span className="text-[10px] text-faint">{it.uom}</span>
                  </div>
                  <div
                    className={cn(
                      "px-2 text-right font-medium text-foreground",
                      NUM,
                      "text-[11.5px]",
                    )}
                  >
                    {formatMoney(r.totalValue)}
                  </div>
                  <div
                    className={cn(
                      "px-2 text-right",
                      NUM,
                      "text-[11.5px]",
                      zero ? "text-faint" : "text-foreground",
                    )}
                  >
                    {zero ? (
                      <span aria-label="No rate — nothing on hand.">—</span>
                    ) : (
                      formatMoney(r.weightedAverageRate as string)
                    )}
                  </div>
                  <div className="flex justify-center text-faint">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* <md site-facing cards — quantity prominent */}
      <div className="md:hidden">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-[12px] font-semibold text-foreground">
              <span
                className={cn(
                  "grid h-5 w-5 flex-none place-items-center rounded-[6px] text-[9.5px] font-bold",
                  group.icon === "godown"
                    ? "bg-warning-soft text-warning-ink"
                    : "bg-info-soft text-info-ink",
                )}
                aria-hidden
              >
                {group.chip}
              </span>
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
                    <div className="font-semibold text-accent-ink [overflow-wrap:anywhere]">
                      {it.name}
                    </div>
                    <div className="text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                      {g.name || g.code}
                    </div>
                    <div className={cn("mt-1 text-[12px]", NUM, "text-muted-foreground")}>
                      {formatMoney(r.totalValue)} ·{" "}
                      {zero ? (
                        <span aria-label="No rate — nothing on hand.">—/{it.uom}</span>
                      ) : (
                        <>
                          {formatMoney(r.weightedAverageRate as string, { withSymbol: false })}/
                          {it.uom}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div
                      className={cn("text-[19px] font-medium text-foreground", NUM)}
                      data-testid="sl-card-qty"
                    >
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
    <div className="flex h-10 items-center gap-2.5 border-b border-muted bg-surface-2 px-4">
      <span
        className={cn(
          "grid h-5 w-5 flex-none place-items-center rounded-[6px] text-[9.5px] font-bold",
          group.icon === "godown"
            ? "bg-warning-soft text-warning-ink"
            : "bg-info-soft text-info-ink",
        )}
        aria-hidden
      >
        {group.chip}
      </span>
      <span className="text-[12.5px] font-bold tracking-[-0.01em] text-foreground [overflow-wrap:anywhere]">
        {group.heading}
      </span>
      <span className="text-[11.5px] text-faint">{group.sub}</span>
    </div>
  );
}
