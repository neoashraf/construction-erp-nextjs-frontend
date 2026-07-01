"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { ActionBadge } from "./ActionBadge";
import { CopyableEntityId } from "./CopyableEntityId";
import { type AuditLogRow } from "../types";

/**
 * Audit-log table (screen spec §4/§5/§10; design file grid). READ-ONLY — a row
 * opens the before/after diff panel; there is NO edit/delete/verify affordance
 * anywhere (FR-AUD-023). Columns per breakpoint (spec §4):
 *  - >=1024 (desktop, primary): Timestamp * Actor * Action * Entity type *
 *    Entity id * Project * IP, diff opens in a side panel.
 *  - >=768 (tablet): drops IP; entity id gets a `title` tooltip; diff opens
 *    full-width instead of a side panel (handled by the parent screen).
 *  - <768: caller renders `AuditMobileCards` instead (stacked summary cards).
 * Keyboard: rows are focusable, Enter opens the detail (spec §10); Timestamp/
 * Actor/Entity-type headers are sortable buttons that announce sort state.
 */

export type AuditSortKey = "createdAt" | "userId" | "entityType";
export type SortDirection = "asc" | "desc";

const GRID_DESKTOP = "lg:grid-cols-[1.05fr_1.4fr_0.85fr_1.05fr_1.3fr_0.9fr_0.85fr_28px]";
const GRID_TABLET = "grid-cols-[1.1fr_1.5fr_0.85fr_1.4fr_28px]";

export function AuditTable({
  rows,
  selectedId,
  sortKey,
  sortDirection,
  onSort,
  onOpen,
}: {
  rows: AuditLogRow[];
  selectedId?: string | null;
  sortKey: AuditSortKey;
  sortDirection: SortDirection;
  onSort: (key: AuditSortKey) => void;
  onOpen: (row: AuditLogRow) => void;
}) {
  return (
    <div
      role="table"
      aria-label="Audit log"
      className="hidden md:block"
      data-testid="audit-table-desktop"
    >
      <div
        role="row"
        className={cn(
          "sticky top-0 z-[2] grid border-b border-border-strong bg-surface-2",
          GRID_TABLET,
          GRID_DESKTOP,
        )}
      >
        <SortableHeaderCell
          label="Timestamp"
          sortKey="createdAt"
          active={sortKey}
          direction={sortDirection}
          onSort={onSort}
        />
        <SortableHeaderCell
          label="Actor"
          sortKey="userId"
          active={sortKey}
          direction={sortDirection}
          onSort={onSort}
        />
        <HeaderCell>Action</HeaderCell>
        <SortableHeaderCell
          label="Entity type"
          sortKey="entityType"
          active={sortKey}
          direction={sortDirection}
          onSort={onSort}
        />
        <HeaderCell className="hidden lg:flex">Entity id</HeaderCell>
        <HeaderCell className="hidden lg:flex">Project</HeaderCell>
        <HeaderCell className="hidden lg:flex">IP</HeaderCell>
        <div role="columnheader" className="hidden h-11 lg:block" />
      </div>

      {rows.map((row) => {
        const selected = row.id === selectedId;
        return (
          <div
            key={row.id}
            role="row"
            tabIndex={0}
            aria-selected={selected}
            onClick={() => onOpen(row)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                onOpen(row);
              }
            }}
            className={cn(
              "relative grid cursor-pointer items-center border-b border-border outline-none",
              GRID_TABLET,
              GRID_DESKTOP,
              selected ? "bg-accent-soft/40" : "hover:bg-surface-2",
              "focus:bg-accent-soft/60",
            )}
            data-testid={`audit-row-${row.id}`}
          >
            {selected && (
              <span
                className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent"
                aria-hidden
              />
            )}

            {/* timestamp */}
            <div className="px-4 py-2.5 font-mono text-[12.5px] tabular-nums text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </div>

            {/* actor */}
            <div className="min-w-0 px-4 py-2.5">
              <div
                className="truncate text-[13px] font-medium text-foreground"
                title={row.userName ?? row.userId}
              >
                {row.userName || row.userId}
              </div>
              {row.userName && (
                <div className="truncate font-mono text-[11px] text-faint">{row.userId}</div>
              )}
            </div>

            {/* action */}
            <div className="px-4 py-2.5">
              <ActionBadge action={row.action} />
            </div>

            {/* entity type — the title tooltip also carries the entity id at <1024,
                where the dedicated Entity id column is hidden (spec §4). */}
            <div className="min-w-0 px-4 py-2.5 text-[13px] text-foreground lg:pr-0">
              <span className="block truncate" title={`${row.entityType} — ${row.entityId}`}>
                {row.entityType}
              </span>
            </div>

            {/* entity id — desktop only (tablet folds it into the entity-type tooltip) */}
            <div className="hidden min-w-0 px-4 py-2.5 lg:block">
              <CopyableEntityId id={row.entityId} />
            </div>

            {/* project — desktop only */}
            <div className="hidden px-4 py-2.5 lg:block">
              {row.projectId ? (
                <span className="inline-flex items-center rounded-pill bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent-ink">
                  {row.projectId}
                </span>
              ) : (
                <span className="text-[12.5px] text-faint">—</span>
              )}
            </div>

            {/* IP — desktop only (spec §4: dropped at <1024) */}
            <div className="hidden px-4 py-2.5 font-mono text-[12px] tabular-nums text-muted-foreground lg:block">
              {row.ipAddress || <span className="text-faint">—</span>}
            </div>

            <div className="hidden items-center justify-center px-1 lg:flex">
              <ChevronRight
                className={cn("h-4 w-4", selected ? "text-accent-ink" : "text-faint")}
                aria-hidden
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="columnheader"
      className={cn(
        "flex h-11 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SortableHeaderCell({
  label,
  sortKey,
  active,
  direction,
  onSort,
}: {
  label: string;
  sortKey: AuditSortKey;
  active: AuditSortKey;
  direction: SortDirection;
  onSort: (key: AuditSortKey) => void;
}) {
  const isActive = active === sortKey;
  const Icon = isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <div role="columnheader" className="flex h-11 items-center px-4">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${isActive ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.4px] transition-colors",
          "focus-visible:outline-none focus-visible:shadow-focus",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        data-testid={`audit-sort-${sortKey}`}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}
