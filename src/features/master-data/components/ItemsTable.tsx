"use client";

import { MoreHorizontal } from "lucide-react";
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
import { type Item } from "../types";

/** A resolved default GL account for an item — code + name for a stacked cell. */
export interface AccountRef {
  code: string;
  name: string;
}

/** Sortable columns and the active sort state (Items.dc.html header affordance). */
export type SortColumn = "code" | "hsCode";
export type SortDirection = "asc" | "desc";
export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot aria-label="Active item">
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot aria-label="Inactive item">
      Inactive
    </Badge>
  );
}

/**
 * Stacked ▲/▼ sort affordance (Items.dc.html). When this column is the active
 * sort, the matching arrow is emphasised and the other dimmed; otherwise both dim.
 */
function SortGlyph({ direction }: { direction?: SortDirection }) {
  const up = direction === "asc";
  const down = direction === "desc";
  return (
    <span aria-hidden className="ml-1 inline-flex flex-col text-[8px] leading-[0.6]">
      <span className={up ? "text-foreground" : "text-faint"}>▲</span>
      <span className={down ? "text-foreground" : "text-faint"}>▼</span>
    </span>
  );
}

/** A clickable, sortable column header that toggles asc → desc → asc on click. */
function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (c: SortColumn) => void;
  className?: string;
}) {
  const active = sort.column === column;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center outline-none transition-colors hover:text-foreground focus-visible:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <SortGlyph direction={active ? sort.direction : undefined} />
      </button>
    </TableHead>
  );
}

function RowActions({
  item,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  item: Item;
  onEdit: (i: Item) => void;
  onDeactivate: (i: Item) => void;
  onReactivate: (i: Item) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${item.code}`}
        data-testid={`item-actions-${item.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-faint transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onEdit(item)}>Edit</DropdownMenuItem>
        {item.isActive ? (
          <DropdownMenuItem
            className="text-destructive-ink"
            onSelect={() => onDeactivate(item)}
          >
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(item)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Item list table (spec §5; Items.dc.html). Desktop dense table; ≤767px stacks as cards. */
export function ItemsTable({
  items,
  account,
  canManage,
  sort,
  onSort,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  items: Item[];
  account: (id: string | null) => AccountRef | null;
  canManage: boolean;
  sort: SortState;
  onSort: (c: SortColumn) => void;
  onEdit: (i: Item) => void;
  onDeactivate: (i: Item) => void;
  onReactivate: (i: Item) => void;
}) {
  return (
    <div>
      {/* Desktop / tablet (≥768px) */}
      <div className="hidden md:block" data-testid="items-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHeader
                label="Code"
                column="code"
                sort={sort}
                onSort={onSort}
                className="cursor-pointer"
              />
              <TableHead>Base UoM</TableHead>
              <SortHeader
                label="H.S. Code"
                column="hsCode"
                sort={sort}
                onSort={onSort}
                className="hidden cursor-pointer lg:table-cell"
              />
              <TableHead className="hidden lg:table-cell">Default account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => {
              const acct = account(it.defaultAccountId);
              return (
                <TableRow key={it.id} data-testid={`item-row-${it.id}`}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onEdit(it)}
                      title={it.code}
                      className="text-left font-mono text-[13.5px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:underline [overflow-wrap:anywhere]"
                    >
                      {it.code}
                    </button>
                    <div
                      title={it.name}
                      className="mt-0.5 text-[12.5px] leading-[1.35] text-foreground [overflow-wrap:anywhere]"
                    >
                      {it.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-foreground">{it.baseUom}</TableCell>
                  <TableCell
                    className={cn(
                      "hidden font-mono text-[12.5px] lg:table-cell",
                      it.hsCode ? "text-foreground" : "text-faint",
                    )}
                  >
                    {it.hsCode ?? "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-[220px] lg:table-cell">
                    {acct ? (
                      <>
                        <span className="block font-mono text-[12.5px] font-semibold text-accent-ink">
                          {acct.code}
                        </span>
                        <div
                          title={acct.name}
                          className="truncate text-[11.5px] text-muted-foreground"
                        >
                          {acct.name}
                        </div>
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={it.isActive} />
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex justify-center">
                        <RowActions
                          item={it}
                          onEdit={onEdit}
                          onDeactivate={onDeactivate}
                          onReactivate={onReactivate}
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards (≤767px) */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="items-cards">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`item-card-${it.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onEdit(it)}
                  className="text-left font-mono text-[13px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:underline [overflow-wrap:anywhere]"
                >
                  {it.code}
                </button>
                <div className="mt-1 text-sm [overflow-wrap:anywhere]">{it.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">Base: {it.baseUom}</div>
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <StatusBadge active={it.isActive} />
                {canManage && (
                  <RowActions
                    item={it}
                    onEdit={onEdit}
                    onDeactivate={onDeactivate}
                    onReactivate={onReactivate}
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
