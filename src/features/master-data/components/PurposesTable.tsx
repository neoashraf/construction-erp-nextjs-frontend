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
import { type Purpose } from "../types";

/**
 * Purpose list table (spec §5; design file `Purposes.dc.html`). Desktop grid ≥768
 * (Name · Status · kebab), cards below. Name is a mono-free lime link and the sortable
 * column; the kebab offers Rename / Deactivate (destructive) / Reactivate, gated by
 * `canManage`. A footer shows the count + the project-scoped posting-dimension hint.
 */

// Matches the design's grid: Name · Status · kebab.
const GRID = "grid-cols-[1fr_150px_56px]";

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot aria-label="Active purpose">
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot aria-label="Inactive purpose">
      Inactive
    </Badge>
  );
}

function RowActions({
  purpose,
  onRename,
  onDeactivate,
  onReactivate,
}: {
  purpose: Purpose;
  onRename: (p: Purpose) => void;
  onDeactivate: (p: Purpose) => void;
  onReactivate: (p: Purpose) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${purpose.name}`}
        data-testid={`purpose-actions-${purpose.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[176px]">
        {purpose.isActive ? (
          <>
            <DropdownMenuItem onSelect={() => onRename(purpose)}>Rename</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDeactivate(purpose)}
              className="text-destructive-ink focus:bg-destructive-soft focus:text-destructive-ink"
            >
              Deactivate
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(purpose)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PurposesTable({
  purposes,
  canManage,
  projectName,
  onRename,
  onDeactivate,
  onReactivate,
}: {
  purposes: Purpose[];
  canManage: boolean;
  /** For the footer hint ("Scoped to {projectName} …"); omitted → generic wording. */
  projectName?: string;
  onRename: (p: Purpose) => void;
  onDeactivate: (p: Purpose) => void;
  onReactivate: (p: Purpose) => void;
}) {
  // Client-side sort by Name (the list API returns unsorted); click toggles asc → desc.
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const sorted = useMemo(() => {
    const arr = purposes.slice();
    arr.sort((a, b) => {
      const cmp = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [purposes, dir]);

  return (
    <div>
      {/* Desktop / tablet grid (≥768) */}
      <div role="table" aria-label="Purposes" className="hidden md:block" data-testid="purposes-desktop">
        {/* header */}
        <div role="row" className={cn("grid rounded-t-card border-b border-border-strong bg-surface-2", GRID)}>
          <button
            type="button"
            role="columnheader"
            aria-sort={dir === "asc" ? "ascending" : "descending"}
            onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="flex h-11 select-none items-center gap-1.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-foreground transition-colors hover:text-primary"
          >
            Name
            <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
              <span className={dir === "asc" ? "text-foreground" : "text-border-strong"}>▲</span>
              <span className={dir === "desc" ? "text-foreground" : "text-border-strong"}>▼</span>
            </span>
          </button>
          <HeaderCell>Status</HeaderCell>
          <div role="columnheader" className="h-11" />
        </div>

        {sorted.map((p) => (
          <div
            key={p.id}
            role="row"
            tabIndex={0}
            className={cn(
              "grid min-h-[52px] items-center border-b border-border outline-none",
              "focus:bg-accent-soft hover:bg-surface-2",
              GRID,
            )}
            data-testid={`purpose-row-${p.id}`}
          >
            {/* name — lime */}
            <div className="min-w-0 px-4 py-2">
              <span className="break-words text-[13.5px] font-semibold leading-snug text-accent-ink" title={p.name}>
                {p.name}
              </span>
            </div>
            {/* status */}
            <div className="px-4 py-2">
              <StatusBadge active={p.isActive} />
            </div>
            {/* kebab */}
            <div className="flex items-center justify-center px-1 py-2">
              {canManage && (
                <RowActions
                  purpose={p}
                  onRename={onRename}
                  onDeactivate={onDeactivate}
                  onReactivate={onReactivate}
                />
              )}
            </div>
          </div>
        ))}

        {/* footer: count + project-scoped posting-dimension hint (design) */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[12.5px] text-muted-foreground">
            {purposes.length} purpose{purposes.length === 1 ? "" : "s"}
          </span>
          <span className="hidden text-[11.5px] text-faint sm:inline">
            {projectName
              ? `Scoped to ${projectName} · used as a posting dimension on this project's vouchers.`
              : "Scoped to this project · used as a posting dimension on its vouchers."}
          </span>
        </div>
      </div>

      {/* Mobile cards (≤767) */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="purposes-cards">
        {sorted.map((p) => (
          <li
            key={p.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`purpose-card-${p.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-accent-ink">{p.name}</div>
                <div className="mt-1.5">
                  <StatusBadge active={p.isActive} />
                </div>
              </div>
              {canManage && (
                <RowActions
                  purpose={p}
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
