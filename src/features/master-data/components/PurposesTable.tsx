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
import { type Purpose } from "../types";

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
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onRename(purpose)}>Rename</DropdownMenuItem>
        {purpose.isActive ? (
          <DropdownMenuItem onSelect={() => onDeactivate(purpose)}>Deactivate</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(purpose)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Purpose list (spec §5). Desktop table; ≤767px cards. */
export function PurposesTable({
  purposes,
  canManage,
  onRename,
  onDeactivate,
  onReactivate,
}: {
  purposes: Purpose[];
  canManage: boolean;
  onRename: (p: Purpose) => void;
  onDeactivate: (p: Purpose) => void;
  onReactivate: (p: Purpose) => void;
}) {
  return (
    <div>
      <div className="hidden md:block" data-testid="purposes-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purposes.map((p) => (
              <TableRow key={p.id} data-testid={`purpose-row-${p.id}`}>
                <TableCell className="text-sm">{p.name}</TableCell>
                <TableCell>
                  <StatusBadge active={p.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end">
                      <RowActions
                        purpose={p}
                        onRename={onRename}
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

      <ul className="flex flex-col gap-2 md:hidden" data-testid="purposes-cards">
        {purposes.map((p) => (
          <li
            key={p.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`purpose-card-${p.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm">{p.name}</div>
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
