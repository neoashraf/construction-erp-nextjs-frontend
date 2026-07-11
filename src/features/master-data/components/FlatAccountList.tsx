"use client";

import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { type Account } from "../types";
import { TypeBadge, TYPE_META, TYPE_PILL } from "./TypeBadge";
import { ACCOUNT_TYPE_LABEL } from "../schemas/chart-of-accounts.schema";

/**
 * Flat account list — shown when searching / filtering (spec §5; design file). Not the
 * deep tree, but the SAME columns at ≥lg (Code · Name | Type | Status | Opening | ⋯);
 * below lg it becomes the design's mobile account cards (code chip · name+meta · ৳ · ⋯).
 */

const COL = {
  type: "w-[144px]",
  status: "w-[116px]",
  opening: "w-[152px]",
  kebab: "w-[46px]",
} as const;

function StatusPill({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "neutral"} dot>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function RowKebab({
  a,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  a: Account;
  onEdit: (a: Account) => void;
  onDeactivate: (a: Account) => void;
  onReactivate: (a: Account) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for account ${a.code}`}
        data-testid={`flat-actions-${a.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-faint outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[176px]">
        <DropdownMenuItem onSelect={() => onEdit(a)}>Edit</DropdownMenuItem>
        {a.isActive ? (
          <DropdownMenuItem
            onSelect={() => onDeactivate(a)}
            className="text-destructive-ink focus:bg-destructive-soft focus:text-destructive-ink"
          >
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(a)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
    <div role="table" aria-label="Accounts">
      {accounts.map((a) => {
        const hasOpen = a.openingBalance != null && a.openingBalance !== "";
        const openingText = hasOpen
          ? formatMoney(a.openingBalance as string, { fractionDigits: 2 })
          : "—";
        const meta = TYPE_META[a.type];
        const metaLine = `${ACCOUNT_TYPE_LABEL[a.type]} · ${a.isActive ? "Active" : "Inactive"}`;
        return (
          <div key={a.id} role="row" data-testid={`flat-account-${a.id}`}>
            {/* desktop columnar */}
            <div className="hidden min-h-[44px] items-stretch border-b border-muted bg-surface hover:bg-surface-2 lg:flex">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-[22px] pr-3">
                <a
                  href="#"
                  className="flex-none font-mono text-[12px] font-semibold text-accent-ink hover:underline"
                >
                  {a.code}
                </a>
                <span className="text-[13.5px] font-medium text-foreground [overflow-wrap:anywhere]">
                  {a.name}
                </span>
                {!a.isActive && <span className="flex-none text-[11.5px] text-faint">(inactive)</span>}
              </div>
              <div className={cn("flex flex-none items-center px-[9px]", COL.type)}>
                <TypeBadge type={a.type} />
              </div>
              <div className={cn("flex flex-none items-center px-[9px]", COL.status)}>
                <StatusPill active={a.isActive} />
              </div>
              <div
                className={cn(
                  "flex flex-none items-center justify-end px-4 font-mono text-[12.5px] tabular-nums",
                  COL.opening,
                  hasOpen ? "text-foreground" : "text-faint",
                )}
              >
                {openingText}
              </div>
              <div className={cn("relative flex flex-none items-center justify-center", COL.kebab)}>
                {canManage && (
                  <RowKebab
                    a={a}
                    onEdit={onEdit}
                    onDeactivate={onDeactivate}
                    onReactivate={onReactivate}
                  />
                )}
              </div>
            </div>

            {/* mobile card */}
            <div className="flex items-center gap-2.5 border-b border-muted bg-surface py-2.5 pl-4 pr-2 lg:hidden">
              <span
                className={cn(
                  "grid h-9 w-9 flex-none place-items-center rounded-[9px] font-mono text-[11px] font-semibold",
                  TYPE_PILL[meta.tone],
                )}
                aria-hidden
              >
                {a.code}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-foreground">{a.name}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">{metaLine}</div>
              </div>
              <span
                className={cn(
                  "flex-none whitespace-nowrap font-mono text-[13px] tabular-nums",
                  hasOpen ? "text-foreground" : "text-faint",
                )}
              >
                {openingText}
              </span>
              {canManage && (
                <RowKebab
                  a={a}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                  onReactivate={onReactivate}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
