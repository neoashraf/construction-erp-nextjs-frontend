"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Repeat2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty } from "@/lib/money";
import { useStockMovements } from "../hooks/useStockMovements";
import { type StockMovementFilter } from "../api/stock-ledger";
import { isValidUiDate, uiDateToApi } from "../schemas/stock-ledger.schema";
import { MOVEMENT_GRID, MovementCard, MovementGridRow } from "./MovementRow";
import { type StockLedgerRow } from "../types";

export interface MovementPanelTarget {
  godownId: string;
  itemId: string;
  godownName: string;
  itemName: string;
  uom: string;
  balance: StockLedgerRow | null;
}

const HEAD = "px-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground";

/**
 * Movement-history drill-down (spec §4.B/§6). A right-side drawer (≥lg) / near-full-screen
 * overlay (<lg) opened from a balance row, pre-filled with that `(godown, item)`. Radix
 * Dialog traps focus, Esc closes + restores focus to the triggering control (spec §10).
 * Independent state matrix — a movements fetch failure never disturbs the balances table
 * behind it. Newest-first default sort (spec §9/§14, non-blocking); a date window narrows
 * `voucherDate`. Offline: an already-open panel keeps its last-loaded content (spec §6).
 */
export function MovementHistoryPanel({
  target,
  offline,
  onClose,
}: {
  target: MovementPanelTarget | null;
  offline: boolean;
  onClose: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const datesValid = isValidUiDate(from) && isValidUiDate(to);
  const rangeOk =
    !from || !to || !datesValid || (uiDateToApi(from) as string) <= (uiDateToApi(to) as string);

  const filter: StockMovementFilter | null = target
    ? {
        godownId: target.godownId,
        itemId: target.itemId,
        dateFrom: datesValid && rangeOk && from ? (uiDateToApi(from) as string) : undefined,
        dateTo: datesValid && rangeOk && to ? (uiDateToApi(to) as string) : undefined,
      }
    : null;

  const query = useStockMovements(filter);
  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const sorted = [...data].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    return sort === "newest" ? sorted : sorted.reverse();
  }, [query.data, sort]);

  const bal = target?.balance ?? null;
  const uom = target?.uom ?? "";

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="w-full max-w-full p-0 sm:w-[912px] sm:max-w-[96%]"
        data-testid="sl-movement-panel"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {target && (
          <div className="flex h-full flex-col">
            {/* header */}
            <div className="flex-none border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11.5px] text-faint">
                    <span>Inventory</span>
                    <span aria-hidden>›</span>
                    <span>Stock Ledger</span>
                    <span aria-hidden>›</span>
                    <span className="font-medium text-foreground [overflow-wrap:anywhere]">
                      {target.godownName} · {target.itemName}
                    </span>
                  </div>
                  <h2
                    className="mt-1.5 text-[17px] font-bold tracking-[-0.01em] text-foreground"
                    data-testid="sl-movement-title"
                  >
                    Movement history — {target.itemName} at {target.godownName}
                  </h2>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onClose} data-testid="sl-movement-back">
                  Back to balances
                </Button>
              </div>

              {/* summary strip */}
              <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                <SummaryCard label="Quantity on hand">
                  {bal ? (
                    <>
                      {formatQty(bal.quantityOnHand, 4)} <span className="text-[12px] text-faint">{uom}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </SummaryCard>
                <SummaryCard label="Total value">{bal ? formatMoney(bal.totalValue) : "—"}</SummaryCard>
                <SummaryCard label="Weighted-avg rate">
                  {bal?.weightedAverageRate ? formatMoney(bal.weightedAverageRate) : "—"}
                </SummaryCard>
              </div>

              {/* date window + sort */}
              <div className="mt-3.5 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sl-mv-from">Date from</Label>
                  <div className="w-[150px]">
                    <DatePickerInput
                      id="sl-mv-from"
                      value={from}
                      onChange={setFrom}
                      invalid={!isValidUiDate(from) || !rangeOk}
                      disabled={offline}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sl-mv-to">Date to</Label>
                  <div className="w-[150px]">
                    <DatePickerInput
                      id="sl-mv-to"
                      value={to}
                      onChange={setTo}
                      invalid={!isValidUiDate(to) || !rangeOk}
                      disabled={offline}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="ml-auto gap-1.5"
                  onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
                  data-testid="sl-mv-sort"
                >
                  <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
                  {sort === "newest" ? "Newest first" : "Oldest first"}
                </Button>
              </div>
              {(!datesValid || !rangeOk) && (
                <p className="mt-2 text-[12px] text-destructive-ink" role="alert" data-testid="sl-mv-date-error">
                  {!datesValid ? "Enter a valid date." : "Date from cannot be after date to."}
                </p>
              )}
            </div>

            {/* movements */}
            <div className="min-h-0 flex-1 overflow-auto">
              {query.isLoading ? (
                <div className="flex flex-col gap-2 p-4" data-testid="sl-mv-loading">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : query.isError ? (
                <div className="p-4">
                  <Alert tone="destructive" title="Couldn't load movement history.">
                    <div className="flex flex-col items-start gap-2">
                      <span>The balances behind this panel are unaffected.</span>
                      <Button size="sm" onClick={() => query.refetch()} data-testid="sl-mv-retry">
                        Retry
                      </Button>
                    </div>
                  </Alert>
                </div>
              ) : rows.length === 0 ? (
                <div className="p-7" data-testid="sl-mv-empty">
                  <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-surface-2 px-5 py-12 text-center">
                    <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-muted text-faint">
                      <Repeat2 className="h-6 w-6" aria-hidden />
                    </div>
                    <p className="text-[14.5px] font-semibold text-foreground">
                      No movements recorded for this item at this godown.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* ≥lg table — scrolls horizontally within the drawer so Source never clips */}
                  <div className="hidden overflow-x-auto lg:block">
                    <div style={{ minWidth: 860 }}>
                      <div
                        className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-5 py-2.5"
                        style={{ gridTemplateColumns: MOVEMENT_GRID }}
                      >
                        <div className={HEAD}>Date</div>
                        <div className={HEAD}>Dir</div>
                        <div className={cn(HEAD, "text-right")}>Quantity</div>
                        <div className={cn(HEAD, "text-right")}>Rate ৳</div>
                        <div className={cn(HEAD, "text-right")}>Value ৳</div>
                        <div className={cn(HEAD, "text-right")}>Bal qty</div>
                        <div className={cn(HEAD, "text-right")}>Bal value ৳</div>
                        <div className={cn(HEAD, "text-right")}>Avg rate ৳</div>
                        <div className={HEAD}>Source</div>
                      </div>
                      {rows.map((m) => (
                        <MovementGridRow key={m.id} m={m} uom={uom} />
                      ))}
                    </div>
                  </div>
                  <div className="lg:hidden">
                    {rows.map((m) => (
                      <MovementCard key={m.id} m={m} uom={uom} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="text-[12px] text-muted-foreground">
                      {rows.length} movement{rows.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-[11px] text-faint">Append-only — every row traces to its source voucher.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-token border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[18px] font-medium tabular-nums text-foreground [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}
