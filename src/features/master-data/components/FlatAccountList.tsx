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
import { type Account } from "../types";
import { TypeBadge } from "./TypeBadge";

/** Flat account list — shown when searching / filtering (spec §5). Not the deep tree. */
export function FlatAccountList({
  accounts,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  accounts: Account[];
  canManage: boolean;
  onEdit: (a: Account) => void;
  onDeactivate: (a: Account) => void;
  onReactivate: (a: Account) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-14 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((a) => (
          <TableRow key={a.id} data-testid={`flat-account-${a.id}`}>
            <TableCell className="font-mono text-[13px] text-accent-ink">{a.code}</TableCell>
            <TableCell>{a.name}</TableCell>
            <TableCell>
              <TypeBadge type={a.type} />
            </TableCell>
            <TableCell>
              {a.isActive ? (
                <Badge tone="success" dot>
                  Active
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Inactive
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              {canManage && (
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for account ${a.code}`}
                      data-testid={`flat-actions-${a.id}`}
                      className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => onEdit(a)}>Edit</DropdownMenuItem>
                      {a.isActive ? (
                        <DropdownMenuItem onSelect={() => onDeactivate(a)}>
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => onReactivate(a)}>
                          Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
