"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type CostCentre } from "../types";

/**
 * Cost-centre list table (spec §5; design file `Cost Centres.dc.html`). Desktop grid
 * ≥768 (Code · Name · Status · kebab), cards below. Code is a mono lime link; the kebab
 * offers Rename / Deactivate (destructive) / Reactivate, gated by `canManage`. A footer
 * summary + the "company-global posting dimension" hint mirror the design.
 */

// Matches the design's grid: Code · Name · Status · kebab.
const GRID = "grid-cols-[1.1fr_2.6fr_0.9fr_56px]";

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot aria-label="Active cost centre">
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot aria-label="Inactive cost centre">
      Inactive
    </Badge>
  );
}

function RowActions({
  centre,
  onRename,
  onDeactivate,
  onReactivate,
}: {
  centre: CostCentre;
  onRename: (c: CostCentre) => void;
  onDeactivate: (c: CostCentre) => void;
  onReactivate: (c: CostCentre) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${centre.code}`}
        data-testid={`cc-actions-${centre.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[176px]">
        {centre.isActive ? (
          <>
            <DropdownMenuItem onSelect={() => onRename(centre)}>Rename</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDeactivate(centre)}
              className="text-destructive-ink focus:bg-destructive-soft focus:text-destructive-ink"
            >
              Deactivate
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(centre)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CostCentresTable({
  centres,
  canManage,
  onRename,
  onDeactivate,
  onReactivate,
}: {
  centres: CostCentre[];
  canManage: boolean;
  onRename: (c: CostCentre) => void;
  onDeactivate: (c: CostCentre) => void;
  onReactivate: (c: CostCentre) => void;
}) {
  // Client-side sort by Code / Name (the list API returns unsorted). Clicking a header
  // toggles asc → desc; a second column resets to that column asc. Mirrors the design.
  const [sort, setSort] = useState<{ key: "code" | "name"; dir: "asc" | "desc" }>({
    key: "code",
    dir: "asc",
  });

  function toggleSort(key: "code" | "name") {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const sorted = useMemo(() => {
    const arr = centres.slice();
    arr.sort((a, b) => {
      const av = (sort.key === "code" ? a.code : a.name) ?? "";
      const bv = (sort.key === "code" ? b.code : b.name) ?? "";
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [centres, sort]);

  return (
    <div>
      {/* Desktop / tablet grid (≥768) */}
      <div role="table" aria-label="Cost centres" className="hidden md:block" data-testid="cc-desktop">
        {/* header */}
        <div role="row" className={cn("grid rounded-t-card border-b border-border-strong bg-surface-2", GRID)}>
          <SortHeaderCell
            label="Code"
            active={sort.key === "code"}
            dir={sort.dir}
            onClick={() => toggleSort("code")}
          />
          <SortHeaderCell
            label="Name"
            active={sort.key === "name"}
            dir={sort.dir}
            onClick={() => toggleSort("name")}
          />
          <HeaderCell>Status</HeaderCell>
          <div role="columnheader" className="h-11" />
        </div>

        {sorted.map((c) => (
          <div
            key={c.id}
            role="row"
            tabIndex={0}
            className={cn(
              "grid min-h-[52px] items-center border-b border-border outline-none",
              "focus:bg-accent-soft hover:bg-surface-2",
              GRID,
            )}
            data-testid={`cc-row-${c.id}`}
          >
            {/* code — mono lime */}
            <div className="min-w-0 px-4 py-2">
              <span className="break-words font-mono text-[13.5px] font-semibold text-accent-ink" title={c.code}>
                {c.code}
              </span>
            </div>
            {/* name */}
            <div className="min-w-0 px-4 py-2">
              <span className="break-words text-[13.5px] leading-snug text-foreground" title={c.name}>
                {c.name}
              </span>
            </div>
            {/* status */}
            <div className="px-4 py-2">
              <StatusBadge active={c.isActive} />
            </div>
            {/* kebab */}
            <div className="flex items-center justify-center px-1 py-2">
              {canManage && (
                <RowActions
                  centre={c}
                  onRename={onRename}
                  onDeactivate={onDeactivate}
                  onReactivate={onReactivate}
                />
              )}
            </div>
          </div>
        ))}

        {/* footer: count + the company-global posting-dimension hint (design) */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[12.5px] text-muted-foreground">
            {centres.length} cost centre{centres.length === 1 ? "" : "s"}
          </span>
          <span className="hidden text-[11.5px] text-faint sm:inline">
            Company-global · used as a posting dimension and the key for project budgets.
          </span>
        </div>
      </div>

      {/* Mobile cards (≤767) */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="cc-cards">
        {centres.map((c) => (
          <li
            key={c.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`cc-card-${c.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-semibold text-accent-ink">{c.code}</div>
                <div className="mt-1 text-sm">{c.name}</div>
                <div className="mt-1.5">
                  <StatusBadge active={c.isActive} />
                </div>
              </div>
              {canManage && (
                <RowActions
                  centre={c}
                  onRename={onRename}
                  onDeactivate={onDeactivate}
                  onReactivate={onReactivate}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="columnheader"
      className="flex h-11 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
    >
      {children}
    </div>
  );
}

/** A sortable header: label + a stacked ▲▼ whose active direction is emphasised (design). */
function SortHeaderCell({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  const asc = active && dir === "asc";
  const desc = active && dir === "desc";
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      onClick={onClick}
      className={cn(
        "flex h-11 select-none items-center gap-1.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.4px] transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
        <span className={asc ? "text-foreground" : "text-border-strong"}>▲</span>
        <span className={desc ? "text-foreground" : "text-border-strong"}>▼</span>
      </span>
    </button>
  );
}
