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

/** Resolved grouping-column label for a row (name or an id-fallback when unresolved). */
export interface GroupLabel {
  label: string;
  unresolved: boolean;
  inactive: boolean;
}

const MONEY = "whitespace-nowrap font-mono text-[13px] tabular-nums";

/** Account-ledger drill-in for a row's EXPENSE lines (spec §5 / SRS §7 flow C). */
function ledgerHref(row: BudgetVsActualRow): string {
  const p = new URLSearchParams({ projectId: row.projectId, costCentreId: row.costCentreId });
  return `/ledger/account-ledger?${p.toString()}`;
}

function emphasis(status: BudgetVsActualRow["status"]): string {
  if (status === "OVER") return "border-l-2 border-l-destructive bg-destructive-soft/40";
  if (status === "APPROACHING") return "border-l-2 border-l-warning bg-warning-soft/40";
  return "border-l-2 border-l-transparent";
}

function Variance({ variance }: { variance: string | null }) {
  if (variance === null) return <span className="text-faint">—</span>;
  const negative = variance.trim().startsWith("-");
  return (
    <span className={cn(MONEY, negative ? "font-semibold text-destructive-ink" : "text-foreground")}>
      {formatMoney(variance)}
    </span>
  );
}

/**
 * Budget-vs-actual results table (spec §4/§5). Desktop (≥lg) = the full grid (grouping ·
 * Budgeted · Actual · Variance · Utilisation · Status · drill); tablet (≥md) merges
 * Variance + Utilisation into one "Budget health" cell; mobile (<md) = stacked cards.
 * OVER / APPROACHING rows carry a left-border + tint emphasis in addition to the badge
 * (never colour-only, §10). The grouping cell links into the Account ledger.
 */
export function BudgetVsActualTable({
  rows,
  groupLabelFor,
  groupHeader,
  canEditBudget,
}: {
  rows: BudgetVsActualRow[];
  groupLabelFor: (row: BudgetVsActualRow) => GroupLabel;
  groupHeader: string;
  canEditBudget: boolean;
}) {
  return (
    <div data-testid="bva-table">
      {/* ≥md table */}
      <div className="hidden md:block">
        <div
          role="row"
          className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          style={{ gridTemplateColumns: GRID }}
        >
          <div className="py-3">{groupHeader}</div>
          <div className="py-3 text-right">Budgeted ৳</div>
          <div className="py-3 text-right">Actual ৳</div>
          <div className="hidden py-3 text-right lg:block">Variance ৳</div>
          <div className="hidden py-3 lg:block">Utilisation %</div>
          <div className="block py-3 lg:hidden">Budget health</div>
          <div className="py-3">Status</div>
          <div className="py-3" />
        </div>
        {rows.map((row) => {
          const g = groupLabelFor(row);
          return (
            <div
              key={`${row.projectId}:${row.costCentreId}`}
              role="row"
              data-testid={`bva-row-${row.status}`}
              className={cn(
                "grid items-center gap-2 border-b border-muted px-4 hover:bg-surface-2",
                emphasis(row.status),
              )}
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="min-w-0 py-3">
                <Link
                  href={ledgerHref(row)}
                  className="font-semibold text-accent-ink hover:underline [overflow-wrap:anywhere]"
                  data-testid="bva-drill"
                >
                  {g.label}
                </Link>
                {g.inactive && <span className="ml-1.5 text-[11.5px] text-faint">(inactive)</span>}
                {g.unresolved && <span className="ml-1.5 text-[11.5px] text-faint">(name unavailable)</span>}
              </div>
              <div className="py-3 text-right">
                {row.budgetedAmount === null ? (
                  <span className="text-faint">—</span>
                ) : (
                  <span className={cn(MONEY, "text-foreground")}>{formatMoney(row.budgetedAmount)}</span>
                )}
              </div>
              <div className="py-3 text-right">
                <span className={cn(MONEY, "font-semibold text-foreground")}>{formatMoney(row.actualCost)}</span>
              </div>
              <div className="hidden py-3 text-right lg:block">
                <Variance variance={row.variance} />
              </div>
              <div className="hidden py-3 lg:block">
                <UtilisationBar pct={row.utilisationPct} status={row.status} />
              </div>
              {/* tablet merged "Budget health" */}
              <div className="block py-3 lg:hidden">
                <UtilisationBar pct={row.utilisationPct} status={row.status} />
                <div className="mt-1 text-right text-[11.5px]">
                  <Variance variance={row.variance} />
                </div>
              </div>
              <div className="py-3">
                <StatusBadge status={row.status} />
              </div>
              <div className="flex justify-end py-3">
                <RowMenu row={row} canEditBudget={canEditBudget} />
              </div>
            </div>
          );
        })}
      </div>

      {/* <md cards */}
      <div className="flex flex-col md:hidden">
        {rows.map((row) => {
          const g = groupLabelFor(row);
          return (
            <div
              key={`${row.projectId}:${row.costCentreId}`}
              data-testid={`bva-card-${row.status}`}
              className={cn("border-b border-muted px-4 py-3", emphasis(row.status))}
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={ledgerHref(row)} className="font-semibold text-accent-ink [overflow-wrap:anywhere]">
                  {g.label}
                  {g.inactive && <span className="ml-1 text-[11px] text-faint">(inactive)</span>}
                  {g.unresolved && <span className="ml-1 text-[11px] text-faint">(name unavailable)</span>}
                </Link>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                <LabelValue label="Budgeted">
                  {row.budgetedAmount === null ? "—" : formatMoney(row.budgetedAmount)}
                </LabelValue>
                <LabelValue label="Actual">{formatMoney(row.actualCost)}</LabelValue>
                <LabelValue label="Variance">
                  {row.variance === null ? "—" : formatMoney(row.variance)}
                </LabelValue>
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

const GRID = "minmax(0,1.6fr) 1fr 1fr 1fr 1.3fr 120px 44px";

function LabelValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-all font-mono text-[10.5px] tabular-nums text-foreground">{children}</div>
    </div>
  );
}

function RowMenu({ row, canEditBudget }: { row: BudgetVsActualRow; canEditBudget: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Row actions"
        data-testid="bva-row-menu"
        className="grid h-7 w-7 place-items-center rounded-token text-faint outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[184px]">
        <DropdownMenuItem asChild>
          <Link href={ledgerHref(row)}>Open expense ledger</Link>
        </DropdownMenuItem>
        {canEditBudget && (
          <DropdownMenuItem asChild>
            <Link href={`/master-data/projects/${row.projectId}`}>Edit budget</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
