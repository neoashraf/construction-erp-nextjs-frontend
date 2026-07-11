"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type ProfitabilityRow } from "../types";

/** Resolved name for a grouping cell ("—" when the dimension isn't part of this mode). */
export interface CellLabel {
  label: string;
  unresolved: boolean;
  inactive: boolean;
}

export type ProfitSort = "asc" | "desc" | null;

const MONEY = "whitespace-nowrap font-mono text-[13px] tabular-nums";
const GRID_LG = "minmax(0,1.5fr) minmax(0,1.3fr) 1.1fr 1.1fr 1.3fr 44px";

/** Drill into the ledger for the row's dimension(s) — both INCOME and EXPENSE (spec §5/§9). */
function ledgerHref(row: ProfitabilityRow): string {
  const p = new URLSearchParams();
  if (row.projectId) p.set("projectId", row.projectId);
  if (row.costCentreId) p.set("costCentreId", row.costCentreId);
  const q = p.toString();
  return q ? `/ledger/account-ledger?${q}` : "/ledger/account-ledger";
}

function isLoss(profit: string): boolean {
  return profit.trim().startsWith("-");
}

function NameTags({ cell }: { cell: CellLabel }) {
  return (
    <>
      {cell.inactive && <span className="ml-1.5 text-[11.5px] text-faint">(inactive)</span>}
      {cell.unresolved && <span className="ml-1.5 text-[11.5px] text-faint">(name unavailable)</span>}
    </>
  );
}

function Profit({ profit }: { profit: string }) {
  const loss = isLoss(profit);
  return (
    <span className={cn(MONEY, loss ? "font-semibold text-destructive-ink" : "font-semibold text-foreground")}>
      {formatMoney(profit)}
      {loss && <span className="ml-1 text-[11px] font-semibold"> (loss)</span>}
    </span>
  );
}

/**
 * Profitability results table (spec §4/§5). Full grid at ≥lg (Cost centre · Project ·
 * Revenue · Cost · Profit · drill); cards below lg (the shell keeps a full sidebar at 768,
 * so a two-text-column table can't fit — same call as the alerts table). NO status badge
 * (FR-CC-009). A loss carries a "(loss)" text qualifier in addition to colour (never
 * colour-only, §10). Profit is the sortable headline column. The grouping cell drills into
 * the Account ledger (both INCOME + EXPENSE lines).
 */
export function ProfitabilityTable({
  rows,
  sort,
  onToggleSort,
  costCentreLabelFor,
  projectLabelFor,
}: {
  rows: ProfitabilityRow[];
  sort: ProfitSort;
  onToggleSort: () => void;
  costCentreLabelFor: (row: ProfitabilityRow) => CellLabel;
  projectLabelFor: (row: ProfitabilityRow) => CellLabel;
}) {
  const SortIcon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ArrowUpDown;
  const ariaSort = sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none";

  return (
    <div data-testid="profit-table">
      {/* ≥lg full grid */}
      <div className="hidden lg:block">
        <div
          role="row"
          className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          style={{ gridTemplateColumns: GRID_LG }}
        >
          <div className="py-3">Cost centre</div>
          <div className="py-3">Project</div>
          <div className="py-3 text-right">Revenue ৳</div>
          <div className="py-3 text-right">Cost ৳</div>
          <div className="py-3 text-right" aria-sort={ariaSort}>
            <button
              type="button"
              onClick={onToggleSort}
              data-testid="profit-sort"
              className="ml-auto inline-flex items-center gap-1 rounded-token px-1 py-0.5 uppercase tracking-[0.4px] hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus"
            >
              Profit ৳
              <SortIcon className="h-3 w-3" aria-hidden />
            </button>
          </div>
          <div className="py-3" />
        </div>
        {rows.map((row, i) => {
          const cc = costCentreLabelFor(row);
          const proj = projectLabelFor(row);
          return (
            <div
              key={`${row.projectId ?? "_"}:${row.costCentreId ?? "_"}:${i}`}
              role="row"
              data-testid={isLoss(row.profit) ? "profit-row-loss" : "profit-row"}
              className="grid items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
              style={{ gridTemplateColumns: GRID_LG }}
            >
              <div className="min-w-0 py-3">
                <Link href={ledgerHref(row)} className="font-semibold text-accent-ink hover:underline [overflow-wrap:anywhere]" data-testid="profit-drill">
                  {cc.label}
                </Link>
                <NameTags cell={cc} />
              </div>
              <div className="min-w-0 py-3 text-[13px] text-foreground [overflow-wrap:anywhere]">
                {proj.label}
                <NameTags cell={proj} />
              </div>
              <div className="py-3 text-right">
                <span className={cn(MONEY, "text-foreground")}>{formatMoney(row.revenue)}</span>
              </div>
              <div className="py-3 text-right">
                <span className={cn(MONEY, "text-foreground")}>{formatMoney(row.cost)}</span>
              </div>
              <div className="py-3 text-right">
                <Profit profit={row.profit} />
              </div>
              <div className="flex justify-end py-3">
                <RowMenu row={row} />
              </div>
            </div>
          );
        })}
      </div>

      {/* <lg stacked cards */}
      <div className="flex flex-col lg:hidden">
        {rows.map((row, i) => {
          const cc = costCentreLabelFor(row);
          const proj = projectLabelFor(row);
          return (
            <div
              key={`${row.projectId ?? "_"}:${row.costCentreId ?? "_"}:${i}`}
              data-testid={isLoss(row.profit) ? "profit-card-loss" : "profit-card"}
              className="border-b border-muted px-4 py-3"
            >
              <div className="min-w-0">
                <Link href={ledgerHref(row)} className="text-[13px] font-semibold text-accent-ink [overflow-wrap:anywhere]">
                  {cc.label}
                  <NameTags cell={cc} />
                </Link>
                {proj.label !== "—" && (
                  <div className="text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                    {proj.label}
                    <NameTags cell={proj} />
                  </div>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <LabelValue label="Revenue">{formatMoney(row.revenue)}</LabelValue>
                <LabelValue label="Cost">{formatMoney(row.cost)}</LabelValue>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-muted pt-2">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">Profit</span>
                <Profit profit={row.profit} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LabelValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-all font-mono text-[11px] tabular-nums text-foreground">{children}</div>
    </div>
  );
}

function RowMenu({ row }: { row: ProfitabilityRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Row actions"
        data-testid="profit-row-menu"
        className="grid h-7 w-7 place-items-center rounded-token text-faint outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[184px]">
        <DropdownMenuItem asChild>
          <Link href={ledgerHref(row)}>Open account ledger</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
