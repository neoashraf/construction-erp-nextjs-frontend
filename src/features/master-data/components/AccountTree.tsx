"use client";

import { ChevronRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type Account, type AccountGroup } from "../types";
import { TypeBadge } from "./TypeBadge";

export interface TreeCallbacks {
  canManage: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEditGroup: (g: AccountGroup) => void;
  onEditAccount: (a: Account) => void;
  onDeactivate: (a: Account) => void;
  onReactivate: (a: Account) => void;
}

function AccountLeaf({
  account,
  cb,
  depth,
}: {
  account: Account;
  cb: TreeCallbacks;
  depth: number;
}) {
  return (
    <li
      role="treeitem"
      aria-selected={false}
      className="list-none"
      data-testid={`account-leaf-${account.id}`}
    >
      <div
        className="flex items-center gap-3 rounded-token py-1.5 pr-2 hover:bg-surface-2"
        style={{ paddingLeft: `${depth * 20 + 28}px` }}
      >
        <span className="w-16 font-mono text-[13px] tabular-nums text-accent-ink">
          {account.code}
        </span>
        <span
          className={cn("flex-1 truncate text-sm", !account.isActive && "text-muted-foreground")}
        >
          {account.name}
          {!account.isActive && <span className="ml-2 text-xs text-faint">(inactive)</span>}
        </span>
        <TypeBadge type={account.type} />
        {cb.canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for account ${account.code}`}
              data-testid={`account-actions-${account.id}`}
              className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => cb.onEditAccount(account)}>Edit</DropdownMenuItem>
              {account.isActive ? (
                <DropdownMenuItem onSelect={() => cb.onDeactivate(account)}>
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => cb.onReactivate(account)}>
                  Reactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}

function GroupNode({
  group,
  groups,
  accounts,
  cb,
  depth,
}: {
  group: AccountGroup;
  groups: AccountGroup[];
  accounts: Account[];
  cb: TreeCallbacks;
  depth: number;
}) {
  const childGroups = groups.filter((g) => g.parentGroupId === group.id);
  const childAccounts = accounts.filter((a) => a.accountGroupId === group.id);
  const isOpen = cb.expanded.has(group.id);
  const isEmpty = childGroups.length === 0 && childAccounts.length === 0;

  return (
    <li
      role="treeitem"
      aria-selected={false}
      aria-expanded={isOpen}
      className="list-none"
      data-testid={`group-node-${group.id}`}
    >
      <div
        className="group flex items-center gap-2 rounded-token py-1.5 pr-2 hover:bg-surface-2"
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => cb.onToggle(group.id)}
          aria-label={isOpen ? `Collapse ${group.name}` : `Expand ${group.name}`}
          className="grid h-6 w-6 flex-none place-items-center rounded-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
            aria-hidden
          />
        </button>
        <span className="flex-1 truncate text-sm font-semibold text-foreground">{group.name}</span>
        <TypeBadge type={group.type} />
        {cb.canManage && (
          <button
            type="button"
            onClick={() => cb.onEditGroup(group)}
            data-testid={`group-edit-${group.id}`}
            className="rounded-sm px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          >
            Edit
          </button>
        )}
      </div>
      {isOpen && (
        <ul role="group">
          {childGroups.map((g) => (
            <GroupNode
              key={g.id}
              group={g}
              groups={groups}
              accounts={accounts}
              cb={cb}
              depth={depth + 1}
            />
          ))}
          {childAccounts.map((a) => (
            <AccountLeaf key={a.id} account={a} cb={cb} depth={depth + 1} />
          ))}
          {isEmpty && (
            <li
              role="treeitem"
              aria-selected={false}
              className="list-none py-1.5 text-xs text-faint"
              style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
            >
              No accounts in this group.
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** ARIA account tree (FR-MAS-017/018, spec §5/§10). Groups nest by parentGroupId. */
export function AccountTree({
  groups,
  accounts,
  cb,
}: {
  groups: AccountGroup[];
  accounts: Account[];
  cb: TreeCallbacks;
}) {
  const roots = groups.filter((g) => g.parentGroupId == null);
  return (
    <ul
      role="tree"
      aria-label="Chart of accounts"
      className="flex flex-col"
      data-testid="account-tree"
    >
      {roots.map((g) => (
        <GroupNode key={g.id} group={g} groups={groups} accounts={accounts} cb={cb} depth={0} />
      ))}
    </ul>
  );
}
