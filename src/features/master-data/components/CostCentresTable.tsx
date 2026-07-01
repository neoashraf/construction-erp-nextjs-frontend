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
import { type CostCentre } from "../types";

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
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onRename(centre)}>Rename</DropdownMenuItem>
        {centre.isActive ? (
          <DropdownMenuItem onSelect={() => onDeactivate(centre)}>Deactivate</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(centre)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Cost-centre list (spec §5). Desktop dense table; ≤767px stacks as cards. */
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
  return (
    <div>
      <div className="hidden md:block" data-testid="cc-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {centres.map((c) => (
              <TableRow key={c.id} data-testid={`cc-row-${c.id}`}>
                <TableCell className="font-mono text-[13px] text-accent-ink">{c.code}</TableCell>
                <TableCell className="text-sm">{c.name}</TableCell>
                <TableCell>
                  <StatusBadge active={c.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end">
                      <RowActions
                        centre={c}
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

      <ul className="flex flex-col gap-2 md:hidden" data-testid="cc-cards">
        {centres.map((c) => (
          <li
            key={c.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`cc-card-${c.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[13px] text-accent-ink">{c.code}</div>
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
