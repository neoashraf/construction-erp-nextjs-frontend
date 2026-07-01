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
import { type Item } from "../types";

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : "—");

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

function RowActions({
  item,
  onDeactivate,
  onReactivate,
}: {
  item: Item;
  onDeactivate: (i: Item) => void;
  onReactivate: (i: Item) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${item.code}`}
        data-testid={`item-actions-${item.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/master-data/items/${item.id}`}>Edit</Link>
        </DropdownMenuItem>
        {item.isActive ? (
          <DropdownMenuItem onSelect={() => onDeactivate(item)}>Deactivate</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(item)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Item list (spec §5). Desktop table; ≤767px cards. */
export function ItemsTable({
  items,
  accountLabel,
  canManage,
  onDeactivate,
  onReactivate,
}: {
  items: Item[];
  accountLabel: (id: string | null) => string;
  canManage: boolean;
  onDeactivate: (i: Item) => void;
  onReactivate: (i: Item) => void;
}) {
  return (
    <div>
      <div className="hidden md:block" data-testid="items-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Base UoM</TableHead>
              <TableHead className="hidden lg:table-cell">H.S. Code</TableHead>
              <TableHead className="hidden lg:table-cell">Default account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id} data-testid={`item-row-${it.id}`}>
                <TableCell>
                  <Link
                    href={`/master-data/items/${it.id}`}
                    className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                  >
                    {it.code}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{it.name}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{it.baseUom}</TableCell>
                <TableCell className="hidden font-mono text-[13px] text-muted-foreground lg:table-cell">
                  {dash(it.hsCode)}
                </TableCell>
                <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                  {accountLabel(it.defaultAccountId)}
                </TableCell>
                <TableCell>
                  <StatusBadge active={it.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end">
                      <RowActions
                        item={it}
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

      <ul className="flex flex-col gap-2 md:hidden" data-testid="items-cards">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`item-card-${it.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/master-data/items/${it.id}`}
                  className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                >
                  {it.code}
                </Link>
                <div className="mt-1 text-sm">{it.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">Base: {it.baseUom}</div>
                <div className="mt-1.5">
                  <StatusBadge active={it.isActive} />
                </div>
              </div>
              {canManage && (
                <RowActions item={it} onDeactivate={onDeactivate} onReactivate={onReactivate} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
