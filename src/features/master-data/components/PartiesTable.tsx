"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { type Party } from "../types";
import { RoleBadges } from "./RoleBadges";

type SortKey = "name" | "terms";
type SortDir = "asc" | "desc";

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : "—");

/** +8801XXXXXXXXX → +880 1XXX-XXXXXX (per Parties.dc.html); leaves anything else as-is. */
function fmtPhone(raw: string | null | undefined): string {
  const v = String(raw ?? "");
  if (/^\+8801\d{9}$/.test(v)) return `+880 ${v.slice(4, 8)}-${v.slice(8)}`;
  return v || "—";
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Inactive
    </Badge>
  );
}

/**
 * The party name in a row. Managers get a button that opens the edit drawer in place
 * (per Parties.dc.html); read-only viewers get a link to the detail page.
 */
function NameLink({
  party,
  canManage,
  onEdit,
}: {
  party: Party;
  canManage: boolean;
  onEdit: (p: Party) => void;
}) {
  const className =
    "text-left text-[13.5px] font-semibold text-accent-ink hover:underline [overflow-wrap:anywhere]";
  if (canManage) {
    return (
      <button type="button" onClick={() => onEdit(party)} className={className}>
        {party.name}
      </button>
    );
  }
  return (
    <Link href={`/master-data/parties/${party.id}`} className={className}>
      {party.name}
    </Link>
  );
}

/**
 * Clickable sortable column header (spec §5; mirrors CostCentresTable). Renders a
 * button inside the <th>, sets `aria-sort` on the header, and emphasises the active
 * ▲/▼ direction. Clicking toggles asc→desc; switching column resets to asc.
 */
function SortableHead({
  label,
  columnKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  columnKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === columnKey;
  const asc = active && sort.dir === "asc";
  const desc = active && sort.dir === "desc";
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("p-0", className)}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          "flex h-10 w-full select-none items-center gap-1.5 px-3 text-left text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
          <span className={asc ? "text-foreground" : "text-border-strong"}>▲</span>
          <span className={desc ? "text-foreground" : "text-border-strong"}>▼</span>
        </span>
      </button>
    </TableHead>
  );
}

function RowActions({
  party,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  party: Party;
  onEdit: (p: Party) => void;
  onDeactivate: (p: Party) => void;
  onReactivate: (p: Party) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${party.name}`}
        data-testid={`party-actions-${party.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-faint transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onEdit(party)}>Edit</DropdownMenuItem>
        {party.isActive ? (
          <DropdownMenuItem
            className="text-destructive-ink"
            onSelect={() => onDeactivate(party)}
          >
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(party)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Party list table (spec §5; Parties.dc.html). Desktop dense table; ≤767px stacks as cards. */
export function PartiesTable({
  parties,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  parties: Party[];
  canManage: boolean;
  onEdit: (p: Party) => void;
  onDeactivate: (p: Party) => void;
  onReactivate: (p: Party) => void;
}) {
  // Client-side sort within the current page (the list API returns unsorted).
  // Clicking a header toggles asc→desc; switching column resets to that column asc.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const sorted = useMemo(() => {
    const arr = parties.slice();
    arr.sort((a, b) => {
      let cmp: number;
      if (sort.key === "name") {
        cmp = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else {
        // Terms: numeric; nulls sort last regardless of direction.
        const av = a.paymentTermsDays;
        const bv = b.paymentTermsDays;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) return 1;
        else if (bv == null) return -1;
        else cmp = av - bv;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [parties, sort]);

  return (
    <div>
      {/* Desktop / tablet (≥768px) */}
      <div className="hidden md:block" data-testid="parties-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead label="Name" columnKey="name" sort={sort} onSort={toggleSort} />
              <TableHead>Roles</TableHead>
              <TableHead className="hidden lg:table-cell">TIN</TableHead>
              <TableHead className="hidden lg:table-cell">BIN</TableHead>
              <SortableHead label="Terms" columnKey="terms" sort={sort} onSort={toggleSort} />
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => (
              <TableRow key={p.id} data-testid={`party-row-${p.id}`}>
                <TableCell>
                  <NameLink party={p} canManage={canManage} onEdit={onEdit} />
                  <div className="mt-0.5 text-[11.5px] tabular-nums text-muted-foreground">
                    {fmtPhone(p.phone)}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-faint lg:hidden">
                    {dash(p.tin)} · {dash(p.bin)}
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadges party={p} />
                </TableCell>
                <TableCell
                  className={cn(
                    "hidden font-mono text-[12.5px] lg:table-cell",
                    p.tin ? "text-foreground" : "text-faint",
                  )}
                >
                  {dash(p.tin)}
                </TableCell>
                <TableCell
                  className={cn(
                    "hidden font-mono text-[12.5px] lg:table-cell",
                    p.bin ? "text-foreground" : "text-faint",
                  )}
                >
                  {dash(p.bin)}
                </TableCell>
                <TableCell className="text-[13px] tabular-nums text-foreground">
                  {p.paymentTermsDays != null ? `${p.paymentTermsDays} days` : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge active={p.isActive} />
                </TableCell>
                <TableCell>
                  {canManage && (
                    <div className="flex justify-center">
                      <RowActions
                        party={p}
                        onEdit={onEdit}
                        onDeactivate={onDeactivate}
                        onReactivate={onReactivate}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards (≤767px) */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="parties-cards">
        {sorted.map((p) => (
          <li
            key={p.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`party-card-${p.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <NameLink party={p} canManage={canManage} onEdit={onEdit} />
                <div className="mt-1.5">
                  <RoleBadges party={p} />
                </div>
                <div className="mt-1.5 font-mono text-xs text-muted-foreground">
                  {fmtPhone(p.phone)}
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <StatusBadge active={p.isActive} />
                {canManage && (
                  <RowActions
                    party={p}
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
