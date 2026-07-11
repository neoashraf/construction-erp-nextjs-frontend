"use client";

import { useEffect, useMemo, useState } from "react";
import { Network, Plus, Search, Check, ChevronDown, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { type Account, type AccountGroup, type AccountType, ACCOUNT_TYPES } from "../types";
import { useAccountGroups, useAccounts } from "../hooks/useChartOfAccounts";
import { AccountTree, type TreeCallbacks } from "./AccountTree";
import { FlatAccountList } from "./FlatAccountList";
import { GroupModal } from "./GroupModal";
import { AccountModal } from "./AccountModal";
import { AccountStatusDialog } from "./AccountStatusDialog";
import { TYPE_META, TYPE_DOT } from "./TypeBadge";

type GroupModalState = { kind: "create"; parentGroupId?: string } | { kind: "edit"; group: AccountGroup } | null;
type AccountModalState = { kind: "create"; groupId?: string } | { kind: "edit"; account: Account } | null;

/** Chart of accounts (FR-MAS-017/018/019/020/021/029/033). Tree + modals + filters. */
export function ChartOfAccountsScreen() {
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant on the resource admits managing. Admin always
  // has it; a custom role granted it in Roles & permissions does too. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.chart_of_accounts", "UPDATE") : false;
  const { toast } = useToast();

  const groupsQuery = useAccountGroups();
  const accountsQuery = useAccounts();
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [q, setQ] = useState("");
  const [groupModal, setGroupModal] = useState<GroupModalState>(null);
  const [accountModal, setAccountModal] = useState<AccountModalState>(null);
  const [statusTarget, setStatusTarget] = useState<{
    account: Account;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  // Default-expand the top-level groups once, when data first arrives.
  useEffect(() => {
    if (!seeded && groups.length > 0) {
      setExpanded(new Set(groups.filter((g) => g.parentGroupId == null).map((g) => g.id)));
      setSeeded(true);
    }
  }, [groups, seeded]);

  const isLoading = groupsQuery.isLoading || accountsQuery.isLoading;
  const isError = groupsQuery.isError || accountsQuery.isError;
  const isEmpty = groups.length === 0 && accounts.length === 0;
  const searching = q.trim() !== "" || typeFilter !== "";

  const flatAccounts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        (typeFilter === "" || a.type === typeFilter) &&
        (needle === "" ||
          a.code.toLowerCase().includes(needle) ||
          a.name.toLowerCase().includes(needle)),
    );
  }, [accounts, q, typeFilter]);

  function reload() {
    groupsQuery.refetch();
    accountsQuery.refetch();
  }

  const cb: TreeCallbacks = {
    canManage,
    expanded,
    onToggle: (id) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    onEditGroup: (g) => setGroupModal({ kind: "edit", group: g }),
    onAddAccount: (groupId) => setAccountModal({ kind: "create", groupId }),
    onAddSubGroup: (parentGroupId) => setGroupModal({ kind: "create", parentGroupId }),
    onEditAccount: (a) => setAccountModal({ kind: "edit", account: a }),
    onDeactivate: (a) => setStatusTarget({ account: a, mode: "deactivate" }),
    onReactivate: (a) => setStatusTarget({ account: a, mode: "reactivate" }),
  };

  const clearFilters = () => {
    setQ("");
    setTypeFilter("");
  };

  const onConflict = () => {
    toast("This was changed by someone else. Reload and try again.", "error");
    reload();
  };

  const countPill = `${accounts.length} account${accounts.length === 1 ? "" : "s"} · ${groups.length} group${groups.length === 1 ? "" : "s"}`;
  const visibleMatches = flatAccounts.length;
  const summary = searching
    ? `${visibleMatches} matching account${visibleMatches === 1 ? "" : "s"}`
    : `${accounts.length} accounts · ${groups.length} groups`;

  return (
    <div>
      {/* title + count pill + page actions (design: content-header actions, right-aligned) */}
      <div className="flex flex-wrap items-center gap-3">
        <Breadcrumb items={[{ label: "Master Data" }, { label: "Chart of accounts" }]} />
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">Chart of accounts</h1>
        <span className="inline-flex h-[23px] items-center whitespace-nowrap rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
          {countPill}
        </span>
        {canManage && (
          <div className="ml-auto flex flex-none gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => setGroupModal({ kind: "create" })}
              data-testid="new-group"
            >
              <Plus className="h-4 w-4 text-accent-ink" aria-hidden />
              New group
            </Button>
            <Button size="md" onClick={() => setAccountModal({ kind: "create" })} data-testid="new-account">
              <Plus className="h-4 w-4" aria-hidden />
              New account
            </Button>
          </div>
        )}
      </div>

      {/* CONTROLS BAR (design: white card · Type dropdown · Search w/ clear · Expand/Collapse) */}
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-end gap-3.5">
          {/* Type filter — custom dropdown w/ coloured dot */}
          <div className="flex flex-none flex-col gap-1.5">
            <Label className="text-[10.5px]">Type</Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Filter by type"
                data-testid="coa-type-filter"
                className="flex h-9 w-[186px] items-center gap-2 rounded-token border border-border-strong bg-surface px-3 text-left text-[13.5px] font-medium text-foreground transition-colors hover:border-border-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "h-2 w-2 flex-none rounded-full border border-border-strong",
                    typeFilter === "" ? "bg-surface" : TYPE_DOT[TYPE_META[typeFilter].tone],
                  )}
                  aria-hidden
                />
                <span className="flex-1">
                  {typeFilter === "" ? "All types" : TYPE_META[typeFilter].label}
                </span>
                <ChevronDown className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[186px]">
                <TypeFilterItem
                  label="All types"
                  dotClass="bg-surface"
                  selected={typeFilter === ""}
                  onSelect={() => setTypeFilter("")}
                />
                {ACCOUNT_TYPES.map((t) => (
                  <TypeFilterItem
                    key={t}
                    label={TYPE_META[t].label}
                    dotClass={TYPE_DOT[TYPE_META[t].tone]}
                    selected={typeFilter === t}
                    onSelect={() => setTypeFilter(t)}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search */}
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <Label htmlFor="coa-search" className="text-[10.5px]">
              Search
            </Label>
            <div className="flex h-9 items-center gap-2 rounded-token border border-border-strong bg-surface px-3 transition-colors focus-within:border-accent focus-within:shadow-focus">
              <Search className="h-4 w-4 flex-none text-faint" aria-hidden />
              <input
                id="coa-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search accounts"
                className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
              />
              {q !== "" && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="flex-none text-faint hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>

          {/* Expand / collapse all */}
          <div className="flex flex-none items-end gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setExpanded(new Set(groups.map((g) => g.id)))}
              data-testid="expand-all"
            >
              Expand all
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setExpanded(new Set())}
              data-testid="collapse-all"
            >
              Collapse all
            </Button>
          </div>
        </div>
      </Card>

      {/* TREE CARD */}
      <Card className="mt-4 overflow-hidden p-0">
        {/* column header — desktop only (design mobile has no header, just category bands) */}
        {!isLoading && !isError && !isEmpty && (
          <div className="hidden h-11 items-center border-b border-border-strong bg-surface-2 lg:flex">
            <div className="min-w-0 flex-1 pl-[22px] text-[11px] font-semibold uppercase tracking-[0.4px] text-foreground">
              Code · Name
            </div>
            <div className="w-[144px] flex-none px-[9px] text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Type
            </div>
            <div className="w-[116px] flex-none px-[9px] text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Status
            </div>
            <div className="w-[152px] flex-none px-4 text-right text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Opening
            </div>
            <div className="w-[46px] flex-none" />
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col" data-testid="coa-loading">
            {[30, 46, 62, 54, 58, 40, 50, 26].map((w, i) => (
              <div
                key={i}
                className="flex min-h-[40px] items-center gap-3 border-b border-muted px-[22px]"
              >
                <span className="h-3 w-3 flex-none rounded-sm bg-muted" />
                <Skeleton className="h-3" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8">
            <div className="flex flex-col items-center rounded-card border border-destructive-soft bg-destructive-soft px-5 py-11 text-center">
              <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-destructive-soft text-[22px] font-bold text-destructive-ink">
                !
              </div>
              <div className="mt-4 text-[15px] font-semibold text-foreground">
                Couldn&apos;t load the chart of accounts.
              </div>
              <div className="mt-1.5 text-[13px] text-muted-foreground">
                The server returned an error. Check your connection and try again.
              </div>
              <Button size="md" className="mt-[18px]" onClick={reload} data-testid="coa-retry">
                Retry
              </Button>
            </div>
          </div>
        ) : isEmpty ? (
          <div className="p-[30px]">
            <div className="flex flex-col items-center rounded-[12px] border-[1.5px] border-dashed border-border-strong bg-surface-2 px-5 py-[50px] text-center">
              <div className="grid h-[54px] w-[54px] place-items-center rounded-[14px] bg-muted text-faint">
                <Network className="h-6 w-6" aria-hidden />
              </div>
              <div className="mt-4 text-[15px] font-semibold text-foreground">No accounts yet.</div>
              <div className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">
                Add account groups and accounts. The standard construction chart of accounts is
                seeded at go-live.
              </div>
              {canManage && (
                <div className="mt-[18px] flex gap-2.5">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setGroupModal({ kind: "create" })}
                    data-testid="empty-new-group"
                  >
                    New group
                  </Button>
                  <Button size="md" onClick={() => setAccountModal({ kind: "create" })}>
                    New account
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : searching ? (
          flatAccounts.length === 0 ? (
            <div className="p-[30px]">
              <div className="flex flex-col items-center rounded-[12px] border-[1.5px] border-dashed border-border-strong bg-surface-2 px-5 py-12 text-center">
                <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-muted text-[22px] text-faint">
                  <Search className="h-5 w-5" aria-hidden />
                </div>
                <div className="mt-4 text-[15px] font-semibold text-foreground">
                  No accounts match.
                </div>
                <div className="mt-1.5 text-[13px] text-muted-foreground">
                  Try a different type or search term.
                </div>
                <Button
                  variant="outline"
                  size="md"
                  className="mt-[18px]"
                  onClick={clearFilters}
                  data-testid="clear-filters"
                >
                  Clear filters
                </Button>
              </div>
            </div>
          ) : (
            <FlatAccountList
              accounts={flatAccounts}
              canManage={canManage}
              onEdit={(a) => setAccountModal({ kind: "edit", account: a })}
              onDeactivate={(a) => setStatusTarget({ account: a, mode: "deactivate" })}
              onReactivate={(a) => setStatusTarget({ account: a, mode: "reactivate" })}
            />
          )
        ) : (
          <>
            <AccountTree groups={groups} accounts={accounts} cb={cb} />
            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
              <span className="text-[12.5px] text-muted-foreground">{summary}</span>
              <span className="hidden text-[11.5px] text-faint sm:inline">
                Indent shows the group → account hierarchy. Opening balances roll up to groups.
              </span>
            </div>
          </>
        )}
      </Card>

      {groupModal && (
        <GroupModal
          mode={
            groupModal.kind === "edit"
              ? { kind: "edit", group: groupModal.group }
              : { kind: "create", parentGroupId: groupModal.parentGroupId }
          }
          groups={groups}
          onClose={() => setGroupModal(null)}
          onSuccess={(m) => toast(m, "success")}
          onConflict={() => {
            setGroupModal(null);
            onConflict();
          }}
          onError={(m) => toast(m, "error")}
        />
      )}

      {accountModal && (
        <AccountModal
          mode={
            accountModal.kind === "edit"
              ? { kind: "edit", account: accountModal.account }
              : { kind: "create", groupId: accountModal.groupId }
          }
          groups={groups}
          onClose={() => setAccountModal(null)}
          onSuccess={(m) => toast(m, "success")}
          onConflict={() => {
            setAccountModal(null);
            onConflict();
          }}
          onError={(m) => toast(m, "error")}
        />
      )}

      <AccountStatusDialog
        account={statusTarget?.account ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
        onReload={reload}
      />
    </div>
  );
}

function TypeFilterItem({
  label,
  dotClass,
  selected,
  onSelect,
}: {
  label: string;
  dotClass: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="h-8 gap-2.5">
      <span
        className={cn("h-2 w-2 flex-none rounded-full border border-border-strong", dotClass)}
        aria-hidden
      />
      <span className="flex-1">{label}</span>
      {selected && <Check className={cn("h-4 w-4 flex-none text-accent-ink")} aria-hidden />}
    </DropdownMenuItem>
  );
}
