"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "./StatusBadge";
import { UtilisationBar } from "./UtilisationBar";
import { type BudgetVsActualRow } from "../types";

/** Resolved name for a grouping cell (name, or an id-fallback when unresolved). */
export interface CellLabel {
  label: string;
  unresolved: boolean;
  inactive: boolean;
}

const MONEY = "whitespace-nowrap font-mono text-[13px] tabular-nums text-foreground";
const GRID_LG = "minmax(0,1.4fr) minmax(0,1.6fr) 1fr 1fr 1.4fr 132px 44px";

/** Drill into the cost centre's EXPENSE ledger lines (spec §5 / LED account ledger). */
function ledgerHref(row: BudgetVsActualRow): string {
  const p = new URLSearchParams({ projectId: row.projectId, costCentreId: row.costCentreId });
  return `/ledger/account-ledger?${p.toString()}`;
}

/** Open the same (project, cost centre) pair in the full budget-vs-actual monitor (spec §5). */
function monitorHref(row: BudgetVsActualRow): string {
  const p = new URLSearchParams({ projectId: row.projectId, costCentreId: row.costCentreId });
  return `/cost-control/budget-vs-actual?${p.toString()}`;
}

function emphasis(status: BudgetVsActualRow["status"]): string {
  if (status === "OVER") return "border-l-2 border-l-destructive bg-destructive-soft/40";
  if (status === "APPROACHING") return "border-l-2 border-l-warning bg-warning-soft/40";
  return "border-l-2 border-l-transparent";
}

function NameTags({ cell }: { cell: CellLabel }) {
  return (
    <>
      {cell.inactive && <span className="ml-1.5 text-[11.5px] text-faint">(inactive)</span>}
      {cell.unresolved && <span className="ml-1.5 text-[11.5px] text-faint">(name unavailable)</span>}
    </>
  );
}

/**
 * Over-budget alerts table (spec §4/§5). Rows are already sorted OVER-before-APPROACHING,
 * then utilisation-descending (screen). Desktop (≥lg) = the full grid; tablet (≥md) merges
 * Budgeted + Actual into one "Budget / Actual" stacked cell; mobile (<md) = stacked alert
 * cards, most-severe first. OVER / APPROACHING carry a left-rail + tint in addition to the
 * badge (never colour-only, §10). The cost-centre cell links into the Account ledger.
 */
export function AlertsTable({
  rows,
  projectLabelFor,
  costCentreLabelFor,
}: {
  rows: BudgetVsActualRow[];
  projectLabelFor: (row: BudgetVsActualRow) => CellLabel;
  costCentreLabelFor: (row: BudgetVsActualRow) => CellLabel;
}) {
  return (
    <div data-testid="alerts-table">
      {/* ≥lg full grid */}
      <div className="hidden lg:block">
        <HeaderRow grid={GRID_LG}>
          <div className="py-3">Project</div>
          <div className="py-3">Cost centre</div>
          <div className="py-3 text-right">Budgeted ৳</div>
          <div className="py-3 text-right">Actual ৳</div>
          <div className="py-3">Utilisation %</div>
          <div className="py-3">Status</div>
          <div className="py-3" />
        </HeaderRow>
        {rows.map((row) => {
          const proj = projectLabelFor(row);
          const cc = costCentreLabelFor(row);
          return (
            <div
              key={`${row.projectId}:${row.costCentreId}`}
              role="row"
              data-testid={`alerts-row-${row.status}`}
              className={cn("grid items-center gap-2 border-b border-muted px-4 hover:bg-surface-2", emphasis(row.status))}
              style={{ gridTemplateColumns: GRID_LG }}
            >
              <div className="min-w-0 py-3 text-[13px] text-foreground [overflow-wrap:anywhere]">
                {proj.label}
                <NameTags cell={proj} />
              </div>
              <div className="min-w-0 py-3">
                <Link href={ledgerHref(row)} className="font-semibold text-accent-ink hover:underline [overflow-wrap:anywhere]" data-testid="alerts-drill">
                  {cc.label}
                </Link>
                <NameTags cell={cc} />
              </div>
              <div className="py-3 text-right">
                <span className={MONEY}>{formatMoney(row.budgetedAmount ?? "0")}</span>
              </div>
              <div className="py-3 text-right">
                <span className={cn(MONEY, "font-semibold")}>{formatMoney(row.actualCost)}</span>
              </div>
              <div className="py-3">
                <UtilisationBar pct={row.utilisationPct} status={row.status} />
              </div>
              <div className="py-3">
                <StatusBadge status={row.status} />
              </div>
              <div className="flex justify-end py-3">
                <RowMenu row={row} />
              </div>
            </div>
          );
        })}
      </div>

      {/* <lg stacked alert cards — the shell keeps the full sidebar at 768, so a
          two-text-column table can't fit; the design's tablet frame assumes an icon rail
          we don't auto-collapse to, so we degrade to the (readable) card layout below lg. */}
      <div className="flex flex-col lg:hidden">
        {rows.map((row) => {
          const proj = projectLabelFor(row);
          const cc = costCentreLabelFor(row);
          return (
            <div
              key={`${row.projectId}:${row.costCentreId}`}
              data-testid={`alerts-card-${row.status}`}
              className={cn("border-b border-muted px-4 py-3", emphasis(row.status))}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
                    {proj.label}
                    <NameTags cell={proj} />
                  </div>
                  <Link href={ledgerHref(row)} className="text-[12px] text-accent-ink [overflow-wrap:anywhere]">
                    {cc.label}
                    <NameTags cell={cc} />
                  </Link>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <LabelValue label="Budgeted">{formatMoney(row.budgetedAmount ?? "0")}</LabelValue>
                <LabelValue label="Actual">{formatMoney(row.actualCost)}</LabelValue>
              </div>
              <div className="mt-2">
                <UtilisationBar pct={row.utilisationPct} status={row.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderRow({ grid, children }: { grid: string; children: React.ReactNode }) {
  return (
    <div
      role="row"
      className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      style={{ gridTemplateColumns: grid }}
    >
      {children}
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

function RowMenu({ row }: { row: BudgetVsActualRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Row actions"
        data-testid="alerts-row-menu"
        className="grid h-7 w-7 place-items-center rounded-token text-faint outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[196px]">
        <DropdownMenuItem asChild>
          <Link href={ledgerHref(row)}>Open expense ledger</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={monitorHref(row)} data-testid="alerts-view-monitor">
            View in Budget vs Actual
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
