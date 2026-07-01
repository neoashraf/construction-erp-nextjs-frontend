"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { type FinancialYear } from "../types";

type SortKey = "label" | "startDate" | "endDate";
type SortDir = "asc" | "desc";

function sortYears(years: FinancialYear[], key: SortKey, dir: SortDir): FinancialYear[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...years].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    // startDate/endDate are ISO (YYYY-MM-DD) so lexical compare == chronological.
    return av < bv ? -factor : av > bv ? factor : 0;
  });
}

/** The active-FY pill (spec §5; aria-labelled for screen readers). */
function ActiveBadge() {
  return (
    <Badge tone="success" dot aria-label="Active financial year">
      Active
    </Badge>
  );
}

/** Row overflow menu (Edit / Set active). Admin-only; hidden for read-only roles. */
function RowActions({
  fy,
  onEdit,
  onSetActive,
}: {
  fy: FinancialYear;
  onEdit: (fy: FinancialYear) => void;
  onSetActive: (fy: FinancialYear) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${fy.label}`}
        data-testid={`fy-actions-${fy.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onEdit(fy)}>Edit</DropdownMenuItem>
        <DropdownMenuItem disabled={fy.isActive} onSelect={() => !fy.isActive && onSetActive(fy)}>
          Set active
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ariaSort(active: boolean, dir: SortDir): "ascending" | "descending" | "none" {
  return active ? (dir === "asc" ? "ascending" : "descending") : "none";
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground hover:text-primary"
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp className="h-3 w-3" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden />
        )
      ) : (
        <ChevronDown className="h-3 w-3 text-faint" aria-hidden />
      )}
    </button>
  );
}

/**
 * Financial-years list (spec §4/§5). Desktop = dense sortable table; ≤767px it
 * stacks as cards (mobile fallback — this is an Admin config screen). The Active
 * column badges exactly one row; Actions collapse into a "⋯" menu (Admin only).
 */
export function FinancialYearsTable({
  years,
  isAdmin,
  onEdit,
  onSetActive,
}: {
  years: FinancialYear[];
  isAdmin: boolean;
  onEdit: (fy: FinancialYear) => void;
  onSetActive: (fy: FinancialYear) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const rows = sortYears(years, sortKey, sortDir);
  const activeCount = years.filter((y) => y.isActive).length;
  const summary = `${years.length} financial year${years.length === 1 ? "" : "s"} · ${activeCount} active`;

  return (
    <div>
      {/* Desktop / tablet table (≥768px) */}
      <div className="hidden md:block" data-testid="fy-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead aria-sort={ariaSort(sortKey === "label", sortDir)}>
                <SortHeader
                  label="Label"
                  active={sortKey === "label"}
                  dir={sortDir}
                  onClick={() => toggleSort("label")}
                />
              </TableHead>
              <TableHead aria-sort={ariaSort(sortKey === "startDate", sortDir)}>
                <SortHeader
                  label="Start date"
                  active={sortKey === "startDate"}
                  dir={sortDir}
                  onClick={() => toggleSort("startDate")}
                />
              </TableHead>
              <TableHead aria-sort={ariaSort(sortKey === "endDate", sortDir)}>
                <SortHeader
                  label="End date"
                  active={sortKey === "endDate"}
                  dir={sortDir}
                  onClick={() => toggleSort("endDate")}
                />
              </TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-14 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((fy) => (
              <TableRow
                key={fy.id}
                className={cn(fy.isActive && "bg-success-soft/40")}
                data-testid={`fy-row-${fy.id}`}
              >
                <TableCell className="font-mono text-sm font-semibold text-accent-ink">
                  {fy.label}
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {formatDate(fy.startDate)}
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {formatDate(fy.endDate)}
                </TableCell>
                <TableCell>
                  {fy.isActive ? <ActiveBadge /> : <span className="text-faint">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin ? (
                    <div className="flex justify-end">
                      <RowActions fy={fy} onEdit={onEdit} onSetActive={onSetActive} />
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[12.5px] text-muted-foreground">{summary}</span>
          <span className="hidden text-[11.5px] text-faint lg:inline">
            Active FY drives the company-wide posting context and the topbar switcher.
          </span>
        </div>
      </div>

      {/* Mobile card stack (≤767px) */}
      <ul className="flex flex-col gap-2 p-3 md:hidden" data-testid="fy-cards">
        {rows.map((fy) => (
          <li
            key={fy.id}
            className={cn(
              "rounded-card border border-border bg-surface p-3",
              fy.isActive && "border-success/40 bg-success-soft/40",
            )}
            data-testid={`fy-card-${fy.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold text-accent-ink">{fy.label}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatDate(fy.startDate)} → {formatDate(fy.endDate)}
                </div>
                <div className="mt-2">
                  {fy.isActive ? (
                    <ActiveBadge />
                  ) : (
                    <span className="text-xs text-faint">Not active</span>
                  )}
                </div>
              </div>
              {isAdmin ? <RowActions fy={fy} onEdit={onEdit} onSetActive={onSetActive} /> : null}
            </div>
          </li>
        ))}
        <li className="px-1 pt-1 text-[12.5px] text-muted-foreground">{summary}</li>
      </ul>
    </div>
  );
}
