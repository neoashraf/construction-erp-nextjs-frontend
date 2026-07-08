"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useItemsList } from "../hooks/useItems";
import { useAccounts } from "../hooks/useChartOfAccounts";
import { type Item } from "../types";
import { ItemsTable } from "./ItemsTable";
import { ItemStatusDialog } from "./ItemStatusDialog";

const PAGE_SIZE = 25;

/** Items list screen (FR-MAS-025/029/033). Filter/search/pagination + table. */
export function ItemsScreen() {
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant admits managing; Admin always has it. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.items", "UPDATE") : false;

  const [activeOnly, setActiveOnly] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [statusTarget, setStatusTarget] = useState<{
    item: Item;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [activeOnly, debouncedQ]);

  const query = useItemsList({
    isActive: activeOnly ? true : undefined,
    q: debouncedQ || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const accountsQuery = useAccounts();
  const accountLabel = useMemo(() => {
    const map = new Map((accountsQuery.data ?? []).map((a) => [a.id, `${a.code} — ${a.name}`]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [accountsQuery.data]);

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = debouncedQ !== "";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Master Data" }, { label: "Items" }]} />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Items</h1>
        </div>
        {canManage && (
          <Button size="md" asChild className="flex-none">
            <Link href="/master-data/items/new" data-testid="new-item">
              <Plus className="h-4 w-4" aria-hidden />
              New item
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Filter by status"
          className="flex gap-0.5 rounded-token border border-border bg-muted p-0.5"
        >
          {[
            { key: true, label: "Active" },
            { key: false, label: "All" },
          ].map((o) => (
            <button
              key={String(o.key)}
              type="button"
              aria-pressed={activeOnly === o.key}
              onClick={() => setActiveOnly(o.key)}
              className={cn(
                "rounded-sm px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                activeOnly === o.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
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
            aria-label="Search items"
            className="pl-9"
          />
        </div>
      </div>

      <Card className="mt-3.5 overflow-hidden p-3 sm:p-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="items-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert tone="destructive" title="Couldn't load items.">
            <div className="flex flex-col items-start gap-2">
              <span>The server returned an error. Check your connection and try again.</span>
              <Button size="sm" onClick={() => query.refetch()} data-testid="items-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No items match these filters."
              action={
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => setQ("")}
                  data-testid="items-clear"
                >
                  Clear
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No items yet."
              description="Add material and service items to use in requisitions and purchases."
              action={
                canManage ? (
                  <Button size="md" asChild>
                    <Link href="/master-data/items/new" data-testid="empty-new-item">
                      <Plus className="h-4 w-4" aria-hidden />
                      New item
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <ItemsTable
              items={rows}
              accountLabel={accountLabel}
              canManage={canManage}
              onDeactivate={(item) => setStatusTarget({ item, mode: "deactivate" })}
              onReactivate={(item) => setStatusTarget({ item, mode: "reactivate" })}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                {total} item{total === 1 ? "" : "s"}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-[12.5px] tabular-nums text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <ItemStatusDialog
        item={statusTarget?.item ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
        onReload={() => query.refetch()}
      />
    </div>
  );
}
