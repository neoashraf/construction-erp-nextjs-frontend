"use client";

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
import { type Party } from "../types";
import { RoleBadges } from "./RoleBadges";

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : "—");

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

function RowActions({
  party,
  onDeactivate,
  onReactivate,
}: {
  party: Party;
  onDeactivate: (p: Party) => void;
  onReactivate: (p: Party) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${party.name}`}
        data-testid={`party-actions-${party.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/master-data/parties/${party.id}`}>Edit</Link>
        </DropdownMenuItem>
        {party.isActive ? (
          <DropdownMenuItem onSelect={() => onDeactivate(party)}>Deactivate</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(party)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Party list table (spec §5). Desktop dense table; ≤767px stacks as cards. */
export function PartiesTable({
  parties,
  canManage,
  onDeactivate,
  onReactivate,
}: {
  parties: Party[];
  canManage: boolean;
  onDeactivate: (p: Party) => void;
  onReactivate: (p: Party) => void;
}) {
  return (
    <div>
      {/* Desktop / tablet (≥768px) */}
      <div className="hidden md:block" data-testid="parties-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="hidden lg:table-cell">TIN</TableHead>
              <TableHead className="hidden lg:table-cell">BIN</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Terms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((p) => (
              <TableRow key={p.id} data-testid={`party-row-${p.id}`}>
                <TableCell>
                  <Link
                    href={`/master-data/parties/${p.id}`}
                    className="font-semibold text-accent-ink hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-0.5 font-mono text-[11px] text-faint lg:hidden">
                    {dash(p.tin)} · {dash(p.bin)}
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadges party={p} />
                </TableCell>
                <TableCell className="hidden font-mono text-[13px] text-muted-foreground lg:table-cell">
                  {dash(p.tin)}
                </TableCell>
                <TableCell className="hidden font-mono text-[13px] text-muted-foreground lg:table-cell">
                  {dash(p.bin)}
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {dash(p.phone)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {p.paymentTermsDays != null ? `${p.paymentTermsDays} days` : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge active={p.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end">
                      <RowActions
                        party={p}
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
        {parties.map((p) => (
          <li
            key={p.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`party-card-${p.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/master-data/parties/${p.id}`}
                  className="font-semibold text-accent-ink hover:underline"
                >
                  {p.name}
                </Link>
                <div className="mt-1.5">
                  <RoleBadges party={p} />
                </div>
                <div className="mt-1.5 font-mono text-xs text-muted-foreground">
                  {dash(p.phone)}
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <StatusBadge active={p.isActive} />
                {canManage && (
                  <RowActions party={p} onDeactivate={onDeactivate} onReactivate={onReactivate} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
