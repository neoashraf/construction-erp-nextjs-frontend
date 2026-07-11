"use client";

import { useMemo } from "react";
import Decimal from "decimal.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { type Account, type AccountGroup, type AccountType } from "../types";
import { TypeBadge, statementOf, TYPE_META, TYPE_PILL } from "./TypeBadge";
import { ACCOUNT_TYPE_LABEL } from "../schemas/chart-of-accounts.schema";

export interface TreeCallbacks {
  canManage: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEditGroup: (g: AccountGroup) => void;
  /** Kebab → "Add account" preselects this group in the account modal. */
  onAddAccount: (groupId: string) => void;
  /** Kebab → "Add sub-group" preselects this group as parent in the group modal. */
  onAddSubGroup: (parentGroupId: string) => void;
  onEditAccount: (a: Account) => void;
  onDeactivate: (a: Account) => void;
  onReactivate: (a: Account) => void;
}

/** Column widths — mirror the design's tree header (Type · Status · Opening · kebab).
 *  Columns collapse below md; on phones the data folds under the name (design §4). */
const COL = {
  type: "w-[144px]",
  status: "w-[116px]",
  opening: "w-[152px]",
  kebab: "w-[46px]",
} as const;

type Row =
  | { kind: "group"; group: AccountGroup; depth: number; open: boolean; count: number; subtotal: Decimal | null }
  | { kind: "account"; account: Account; depth: number }
  | { kind: "empty"; depth: number; key: string };

/** Indent rails — one 1px guide line per ancestor level (design). */
function Rails({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        <span key={i} className="relative w-[22px] flex-none" aria-hidden>
          <span className="absolute bottom-0 top-0 w-px bg-border-strong" style={{ left: 11 }} />
        </span>
      ))}
    </>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "neutral"} dot>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function OpeningCell({ text, muted }: { text: string; muted: boolean }) {
  return (
    <div
      className={cn(
        "hidden flex-none items-center justify-end px-4 font-mono text-[12.5px] tabular-nums lg:flex",
        COL.opening,
        muted ? "text-faint" : "text-foreground",
      )}
    >
      {text}
    </div>
  );
}

export function AccountTree({
  groups,
  accounts,
  cb,
  minH = 40,
  pad = 6,
}: {
  groups: AccountGroup[];
  accounts: Account[];
  cb: TreeCallbacks;
  minH?: number;
  pad?: number;
}) {
  const rows = useMemo<Row[]>(() => {
    const accountsOf = (gid: string) => accounts.filter((a) => a.accountGroupId === gid);
    const childGroupsOf = (gid: string | null) =>
      groups.filter((g) => g.parentGroupId === (gid ?? null));

    // Recursive opening-balance rollup (design: subtotals roll up to groups).
    const subtotal = (gid: string): Decimal | null => {
      let sum = new Decimal(0);
      let any = false;
      for (const a of accountsOf(gid)) {
        if (a.openingBalance != null && a.openingBalance !== "") {
          sum = sum.plus(new Decimal(a.openingBalance));
          any = true;
        }
      }
      for (const g of childGroupsOf(gid)) {
        const sv = subtotal(g.id);
        if (sv != null) {
          sum = sum.plus(sv);
          any = true;
        }
      }
      return any ? sum : null;
    };
    // Total descendant account count (design: "N accounts" on the group row).
    const descAccounts = (gid: string): number => {
      let n = accountsOf(gid).length;
      for (const g of childGroupsOf(gid)) n += descAccounts(g.id);
      return n;
    };

    const out: Row[] = [];
    let emptyKey = 0;
    const addGroup = (g: AccountGroup, depth: number) => {
      const open = cb.expanded.has(g.id);
      out.push({
        kind: "group",
        group: g,
        depth,
        open,
        count: descAccounts(g.id),
        subtotal: subtotal(g.id),
      });
      if (open) {
        const subs = childGroupsOf(g.id);
        const accs = accountsOf(g.id);
        subs.forEach((sg) => addGroup(sg, depth + 1));
        accs.forEach((a) => out.push({ kind: "account", account: a, depth: depth + 1 }));
        if (subs.length + accs.length === 0)
          out.push({ kind: "empty", depth: depth + 1, key: `e${emptyKey++}` });
      }
    };
    childGroupsOf(null).forEach((g) => addGroup(g, 0));
    return out;
  }, [groups, accounts, cb.expanded]);

  return (
    <div role="tree" aria-label="Chart of accounts">
      {rows.map((row) => {
        if (row.kind === "group") return <GroupRow key={row.group.id} row={row} cb={cb} minH={minH} pad={pad} />;
        if (row.kind === "account")
          return <AccountRow key={row.account.id} account={row.account} depth={row.depth} cb={cb} minH={minH} pad={pad} />;
        return <EmptyRow key={row.key} depth={row.depth} />;
      })}
    </div>
  );
}

function GroupKebab({ g, cb }: { g: AccountGroup; cb: TreeCallbacks }) {
  if (!cb.canManage) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for group ${g.name}`}
        data-testid={`group-actions-${g.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-faint outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        ⋯
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[186px]">
        <DropdownMenuItem onSelect={() => cb.onEditGroup(g)}>Edit group</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => cb.onAddAccount(g.id)}>Add account</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => cb.onAddSubGroup(g.id)}>Add sub-group</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GroupRow({
  row,
  cb,
  minH,
  pad,
}: {
  row: Extract<Row, { kind: "group" }>;
  cb: TreeCallbacks;
  minH: number;
  pad: number;
}) {
  const { group: g, depth, open, count, subtotal } = row;
  const top = depth === 0;
  const countText = count > 0 ? `${count} account${count === 1 ? "" : "s"}` : "empty";

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={open}
      aria-selected={false}
      tabIndex={0}
      data-testid={`group-node-${g.id}`}
      className="outline-none"
    >
      {/* ───── DESKTOP (≥lg): columnar row ───── */}
      <div
        className={cn(
          "relative hidden items-stretch border-b border-muted lg:flex",
          "hover:bg-surface-2",
          top ? "bg-surface-2" : "bg-surface",
        )}
        style={{ minHeight: minH }}
      >
        <div className="flex min-w-0 flex-1 items-stretch">
          <Rails depth={depth} />
          <button
            type="button"
            onClick={() => cb.onToggle(g.id)}
            aria-label={open ? `Collapse ${g.name}` : `Expand ${g.name}`}
            className="flex min-w-0 flex-1 items-center gap-2 pr-3 text-left"
            style={{ paddingTop: pad, paddingBottom: pad }}
          >
            <span className="flex w-[22px] flex-none items-center justify-center text-[11px] text-muted-foreground">
              {open ? "▾" : "▸"}
            </span>
            <span
              className="tracking-[-0.01em] text-foreground [overflow-wrap:anywhere]"
              style={{ fontSize: top ? 14 : 13.5, fontWeight: top ? 700 : 600 }}
            >
              {g.name}
            </span>
            {top && (
              <span className="flex h-[18px] flex-none items-center rounded-[5px] bg-muted px-[7px] text-[10px] font-semibold tracking-[0.3px] text-muted-foreground">
                {statementOf(g.type)}
              </span>
            )}
          </button>
        </div>
        <div className={cn("flex flex-none items-center px-[9px]", COL.type)}>
          <TypeBadge type={g.type} />
        </div>
        <div className={cn("flex flex-none items-center px-[9px] text-[12px] text-faint", COL.status)}>
          {countText}
        </div>
        <OpeningCell
          muted
          text={subtotal != null ? formatMoney(subtotal, { fractionDigits: 2 }) : "—"}
        />
        <div className={cn("relative flex flex-none items-center justify-center", COL.kebab)}>
          <GroupKebab g={g} cb={cb} />
        </div>
      </div>

      {/* ───── MOBILE (<lg): category band (top) / sub-group header (nested) ───── */}
      {top ? (
        <div className="relative flex items-center gap-2 px-3 pb-2 pt-3.5 lg:hidden">
          <button
            type="button"
            onClick={() => cb.onToggle(g.id)}
            aria-label={open ? `Collapse ${g.name}` : `Expand ${g.name}`}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="text-[10px] text-muted-foreground">{open ? "▾" : "▸"}</span>
            <span className="text-[11.5px] font-bold uppercase tracking-[0.5px] text-foreground">
              {g.name}
            </span>
          </button>
          <TypeBadge type={g.type} size="sm" />
          <span className="h-px flex-1 bg-border" aria-hidden />
          <GroupKebab g={g} cb={cb} />
        </div>
      ) : (
        <div
          className="relative flex items-center gap-2 border-y border-muted bg-surface-2 py-2 pl-4 pr-3 lg:hidden"
          style={{ paddingLeft: 16 + depth * 12 }}
        >
          <button
            type="button"
            onClick={() => cb.onToggle(g.id)}
            aria-label={open ? `Collapse ${g.name}` : `Expand ${g.name}`}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="text-[10px] text-muted-foreground">{open ? "▾" : "▸"}</span>
            <span className="text-[12.5px] font-semibold text-foreground [overflow-wrap:anywhere]">
              {g.name}
            </span>
          </button>
          <span className="text-[11px] text-faint">{countText}</span>
          <GroupKebab g={g} cb={cb} />
        </div>
      )}
    </div>
  );
}

function AccountKebab({ a, cb }: { a: Account; cb: TreeCallbacks }) {
  if (!cb.canManage) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for account ${a.code}`}
        data-testid={`account-actions-${a.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-faint outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        ⋯
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[176px]">
        <DropdownMenuItem onSelect={() => cb.onEditAccount(a)}>Edit</DropdownMenuItem>
        {a.isActive ? (
          <DropdownMenuItem
            onSelect={() => cb.onDeactivate(a)}
            className="text-destructive-ink focus:bg-destructive-soft focus:text-destructive-ink"
          >
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => cb.onReactivate(a)}>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountRow({
  account: a,
  depth,
  cb,
  minH,
  pad,
}: {
  account: Account;
  depth: number;
  cb: TreeCallbacks;
  minH: number;
  pad: number;
}) {
  const hasOpen = a.openingBalance != null && a.openingBalance !== "";
  const openingText = hasOpen ? formatMoney(a.openingBalance as string, { fractionDigits: 2 }) : "—";
  const meta = TYPE_META[a.type as AccountType];
  const metaLine = `${ACCOUNT_TYPE_LABEL[a.type as AccountType]} · ${a.isActive ? "Active" : "Inactive"}`;

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={false}
      tabIndex={0}
      data-testid={`account-leaf-${a.id}`}
      className="outline-none"
    >
      {/* ───── DESKTOP (≥lg): columnar row ───── */}
      <div
        className="relative hidden items-stretch border-b border-muted bg-surface hover:bg-surface-2 lg:flex"
        style={{ minHeight: minH }}
      >
        <div className="flex min-w-0 flex-1 items-stretch">
          <Rails depth={depth} />
          <span className="flex w-[22px] flex-none items-center justify-center" aria-hidden>
            <span className="h-[5px] w-[5px] rounded-full bg-border-hover" />
          </span>
          <div
            className="flex min-w-0 flex-1 items-center gap-2.5 pr-3"
            style={{ paddingTop: pad, paddingBottom: pad }}
          >
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
        </div>
        <div className={cn("flex flex-none items-center px-[9px]", COL.type)}>
          <TypeBadge type={a.type as AccountType} />
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
          <AccountKebab a={a} cb={cb} />
        </div>
      </div>

      {/* ───── MOBILE (<lg): account card — code chip · name+meta · ৳ amount · ⋯ ───── */}
      <div className="relative flex items-center gap-2.5 border-b border-muted bg-surface py-2.5 pl-4 pr-2 lg:hidden">
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
        <AccountKebab a={a} cb={cb} />
      </div>
    </div>
  );
}

function EmptyRow({ depth }: { depth: number }) {
  return (
    <div className="border-b border-muted bg-surface">
      {/* desktop */}
      <div className="hidden items-stretch lg:flex" style={{ minHeight: 40 }}>
        <div className="flex min-w-0 flex-1 items-stretch">
          <Rails depth={depth} />
          <span className="w-[22px] flex-none" />
          <div className="flex flex-1 items-center py-2 text-[12.5px] italic text-faint">
            No accounts in this group.
          </div>
        </div>
        <div className={cn("flex-none", COL.type)} />
        <div className={cn("flex-none", COL.status)} />
        <div className={cn("flex-none", COL.opening)} />
        <div className={cn("flex-none", COL.kebab)} />
      </div>
      {/* mobile */}
      <div className="px-4 py-2.5 text-[12.5px] italic text-faint lg:hidden">
        No accounts in this group.
      </div>
    </div>
  );
}
