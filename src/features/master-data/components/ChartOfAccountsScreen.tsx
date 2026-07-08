"use client";

import { useEffect, useMemo, useState } from "react";
import { Network, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { type Account, type AccountGroup, type AccountType, ACCOUNT_TYPES } from "../types";
import { ACCOUNT_TYPE_LABEL } from "../schemas/chart-of-accounts.schema";
import { useAccountGroups, useAccounts } from "../hooks/useChartOfAccounts";
import { AccountTree, type TreeCallbacks } from "./AccountTree";
import { FlatAccountList } from "./FlatAccountList";
import { GroupModal } from "./GroupModal";
import { AccountModal } from "./AccountModal";
import { AccountStatusDialog } from "./AccountStatusDialog";

type GroupModalState = { kind: "create" } | { kind: "edit"; group: AccountGroup } | null;
type AccountModalState = { kind: "create" } | { kind: "edit"; account: Account } | null;

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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Master Data" }, { label: "Chart of accounts" }]} />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Chart of accounts</h1>
        </div>
        {canManage && (
          <div className="flex flex-none gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => setGroupModal({ kind: "create" })}
              data-testid="new-group"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New group
            </Button>
            <Button
              size="md"
              onClick={() => setAccountModal({ kind: "create" })}
              data-testid="new-account"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New account
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AccountType | "")}
          >
            <option value="">All types</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative w-full max-w-[280px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or name…"
            aria-label="Search accounts"
            className="pl-9"
          />
        </div>
        {!searching && groups.length > 0 && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(new Set(groups.map((g) => g.id)))}
              data-testid="expand-all"
            >
              Expand all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(new Set())}
              data-testid="collapse-all"
            >
              Collapse all
            </Button>
          </div>
        )}
      </div>

      <Card className="mt-3.5 overflow-hidden p-3 sm:p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2" data-testid="coa-loading">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8" style={{ width: `${90 - i * 8}%` }} />
            ))}
          </div>
        ) : isError ? (
          <Alert tone="destructive" title="Couldn't load the chart of accounts.">
            <div className="flex flex-col items-start gap-2">
              <span>The server returned an error. Check your connection and try again.</span>
              <Button size="sm" onClick={reload} data-testid="coa-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : isEmpty ? (
          <EmptyState
            icon={Network}
            title="No accounts yet."
            description="Create account groups and accounts to author the posting chart."
            action={
              canManage ? (
                <Button
                  size="md"
                  onClick={() => setGroupModal({ kind: "create" })}
                  data-testid="empty-new-group"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  New group
                </Button>
              ) : undefined
            }
          />
        ) : searching ? (
          flatAccounts.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No accounts match."
              action={
                <Button
                  size="md"
                  variant="outline"
                  onClick={clearFilters}
                  data-testid="clear-filters"
                >
                  Clear
                </Button>
              }
            />
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
          <AccountTree groups={groups} accounts={accounts} cb={cb} />
        )}
      </Card>

      {groupModal && (
        <GroupModal
          mode={
            groupModal.kind === "edit"
              ? { kind: "edit", group: groupModal.group }
              : { kind: "create" }
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
              : { kind: "create" }
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
