"use client";

import { useMemo, useState } from "react";
import { PackageOpen, WifiOff, Calendar, ChevronDown, Check, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/hooks/use-online";
import { type ApiError } from "@/lib/api";
import { useStockLedger } from "../hooks/useStockLedger";
import { useGodownOptions, useItemOptions, useProjectOptions } from "../hooks/useInventoryOptions";
import { type StockLedgerFilter } from "../api/stock-ledger";
import {
  isLedgerFiltered,
  isValidUiDate,
  uiDateToApi,
  type LedgerFilter,
  type LedgerGroupBy,
} from "../schemas/stock-ledger.schema";
import { GroupingToggle } from "./GroupingToggle";
import { StockLedgerFilterBar, type LedgerScopeFilter } from "./StockLedgerFilterBar";
import { StockBalancesTable, type LedgerNameMaps } from "./StockBalancesTable";
import { MovementHistoryPanel, type MovementPanelTarget } from "./MovementHistoryPanel";
import { type StockLedgerRow } from "../types";

/**
 * Stock Ledger screen (spec §4/§6). Read-only balances landing view + a movement-history
 * drill-down drawer, over the same `(godown, item)` projection. As-of-date + grouping live
 * in the header; godown/item/project in the filter bar. Independent state matrices for the
 * balances table and the drawer. Offline: last-loaded balances stay, but a new as-of query
 * or a new drawer open is blocked (spec §6). No write affordance anywhere (FR-INV-004).
 */
export function StockLedgerScreen() {
  const online = useOnline();
  const [scope, setScope] = useState<LedgerScopeFilter>({
    godownId: "",
    itemId: "",
    projectId: "",
  });
  const [asOf, setAsOf] = useState(""); // DD/MM/YYYY UI string; "" = Latest
  const [asOfOpen, setAsOfOpen] = useState(false);
  const [asOfDraft, setAsOfDraft] = useState(""); // popover-local date draft
  const [groupBy, setGroupBy] = useState<LedgerGroupBy>("godown");
  const [target, setTarget] = useState<MovementPanelTarget | null>(null);

  const asOfValid = isValidUiDate(asOf);
  const applied: LedgerFilter = { ...scope, asOfDate: asOf };

  const apiFilter: StockLedgerFilter = {
    godownId: scope.godownId || undefined,
    itemId: scope.itemId || undefined,
    projectId: scope.projectId || undefined,
    asOfDate: asOf && asOfValid ? (uiDateToApi(asOf) as string) : undefined,
  };

  const query = useStockLedger(apiFilter);
  const rows = query.data?.data ?? [];

  const projects = useProjectOptions().data ?? [];
  const godownsData = useGodownOptions().data;
  const itemsData = useItemOptions().data;

  const maps: LedgerNameMaps = useMemo(
    () => ({
      godowns: new Map((godownsData ?? []).map((g) => [g.id, g])),
      items: new Map((itemsData ?? []).map((i) => [i.id, i])),
    }),
    [godownsData, itemsData],
  );

  const balanceCount = rows.length;
  const godownCount = new Set(rows.map((r) => r.godownId)).size;
  const asOfLabel = asOf && asOfValid ? asOf : "Latest";

  const err = query.error as ApiError | null;
  const isForbidden = query.isError && err?.code === "FORBIDDEN";

  function pickLatest() {
    setAsOf("");
    setAsOfDraft("");
    setAsOfOpen(false);
  }
  function applyAsOfDraft() {
    setAsOf(asOfDraft.trim());
    setAsOfOpen(false);
  }
  const draftValid = isValidUiDate(asOfDraft) && asOfDraft.trim() !== "";

  function openMovements(row: StockLedgerRow) {
    if (!online) return; // a new drawer open requires a fresh fetch (spec §6)
    const g = maps.godowns.get(row.godownId);
    const it = maps.items.get(row.itemId);
    setTarget({
      godownId: row.godownId,
      itemId: row.itemId,
      godownName: g ? `${g.code} — ${g.name}` : row.godownId.slice(0, 8),
      itemName: it?.name ?? row.itemId.slice(0, 8),
      uom: it?.uom ?? "",
      balance: row,
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="mb-4 mt-1 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="sl-title">
              Stock Ledger
            </h1>
            <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-faint" aria-hidden />
              Derived · read-only
            </span>
            {query.data && (
              <span className="inline-flex h-[23px] items-center rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
                {balanceCount} balance{balanceCount === 1 ? "" : "s"} · {godownCount} godown
                {godownCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {/* as-of + grouping */}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              As of
            </span>
            <DropdownMenu
              modal={false}
              open={asOfOpen}
              onOpenChange={(o) => {
                setAsOfOpen(o);
                if (o) setAsOfDraft(asOf);
              }}
            >
              <DropdownMenuTrigger asChild disabled={!online}>
                <button
                  type="button"
                  data-testid="sl-asof-trigger"
                  className="flex h-9 items-center gap-2 rounded-token border border-border-strong bg-surface px-3 text-[13px] font-semibold text-foreground hover:border-border-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span>{asOfLabel}</span>
                  <ChevronDown className="h-3 w-3 text-faint" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                <button
                  type="button"
                  onClick={pickLatest}
                  data-testid="sl-asof-latest"
                  className="flex h-[34px] w-full items-center gap-2 rounded-token px-2.5 text-[13px] font-medium text-foreground hover:bg-muted"
                >
                  <span className="flex-1 text-left">Latest (current balance)</span>
                  {!asOf && <Check className="h-3.5 w-3.5 text-accent-ink" aria-hidden />}
                </button>
                <div className="mx-1 my-1.5 h-px bg-border" />
                <div className="px-1.5 pb-1.5 pt-0.5">
                  <label
                    htmlFor="sl-asof-date"
                    className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
                  >
                    As-of date
                  </label>
                  <input
                    id="sl-asof-date"
                    value={asOfDraft}
                    onChange={(e) => setAsOfDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && draftValid) applyAsOfDraft();
                    }}
                    placeholder="DD/MM/YYYY"
                    inputMode="numeric"
                    data-testid="sl-asof-date"
                    className={cn(
                      "h-9 w-full rounded-token border border-border-strong bg-surface px-2.5 font-mono text-[13px] tabular-nums text-foreground placeholder:text-faint",
                      "focus:border-accent focus:shadow-focus focus:outline-none",
                      asOfDraft.trim() !== "" &&
                        !isValidUiDate(asOfDraft) &&
                        "border-destructive focus:border-destructive focus:shadow-focus-error",
                    )}
                  />
                  <Button
                    type="button"
                    size="md"
                    disabled={!draftValid}
                    onClick={applyAsOfDraft}
                    data-testid="sl-asof-apply"
                    className="mt-2 h-8 w-full text-[12.5px]"
                  >
                    Apply as-of
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <GroupingToggle value={groupBy} onChange={setGroupBy} />
        </div>
      </div>

      {!online && (
        <Alert
          tone="warning"
          className="mb-3"
          title="You're offline. Showing the last loaded balances."
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            As-of-date changes and new movement views are paused until you reconnect.
          </span>
        </Alert>
      )}

      <StockLedgerFilterBar
        scope={scope}
        projects={projects}
        godowns={godownsData ?? []}
        items={itemsData ?? []}
        disabled={!online}
        onApply={setScope}
        onClear={() => setScope({ godownId: "", itemId: "", projectId: "" })}
      />

      <Card
        className={cn(
          "mt-4 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="sl-loading">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isForbidden ? (
          <div className="p-4">
            <Alert
              tone="destructive"
              title="You can only view your assigned projects."
              data-testid="sl-forbidden"
            >
              Choose a godown or project within your assigned scope.
            </Alert>
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load the stock ledger.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="sl-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isLedgerFiltered(applied) ? (
            <div className="p-8" data-testid="sl-empty-filtered">
              <EmptyState
                icon={PackageOpen}
                title="No stock balances match these filters."
                description="Try a different godown, item, or as-of date."
                action={
                  <Button
                    size="md"
                    variant="outline"
                    onClick={() => {
                      setScope({ godownId: "", itemId: "", projectId: "" });
                      setAsOf("");
                    }}
                    data-testid="sl-empty-clear"
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8" data-testid="sl-empty-firstuse">
              <EmptyState
                icon={PackageOpen}
                title="No stock movements recorded yet for this project."
                description="Balances appear once material is received, transferred, or issued through a Stock Journal or a purchase receipt."
              />
            </div>
          )
        ) : (
          <StockBalancesTable
            rows={rows}
            maps={maps}
            groupBy={groupBy}
            asOfLabel={asOfLabel}
            onView={openMovements}
          />
        )}
      </Card>

      {/* derived-framing footnote — shown in every state (design §footnote) */}
      <div className="mt-3 flex max-w-[880px] gap-2.5 rounded-token border border-border bg-surface-2 px-3.5 py-3">
        <Info className="mt-px h-3.5 w-3.5 flex-none text-info" aria-hidden />
        <span
          className="text-[12px] leading-[1.5] text-muted-foreground"
          data-testid="sl-derived-note"
        >
          Balances are derived from posted movements — they change only by posting or reversing a
          Stock Journal, Goods Receipt, or Requisition Issue. Nothing is written from this screen.
        </span>
      </div>

      <MovementHistoryPanel target={target} offline={!online} onClose={() => setTarget(null)} />
    </div>
  );
}
