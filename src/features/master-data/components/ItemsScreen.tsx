"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Search, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useItemsList } from "../hooks/useItems";
import { useAccounts } from "../hooks/useChartOfAccounts";
import { type Item } from "../types";
import { ItemFilterBar, type ItemStatusFilter } from "./ItemFilterBar";
import {
  ItemsTable,
  type AccountRef,
  type SortColumn,
  type SortState,
} from "./ItemsTable";
import { ItemFormDrawer } from "./ItemFormDrawer";
import { ItemStatusDialog } from "./ItemStatusDialog";

type Drawer = { kind: "create" } | { kind: "edit"; item: Item } | null;

const PAGE_SIZE = 25;

/** Items list screen (FR-MAS-025/029/033). Filter/search/pagination + table. */
export function ItemsScreen() {
  const session = useSession();
  const { toast } = useToast();
  // Permission-driven (FE-21): UPDATE grant admits managing; Admin always has it. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.items", "UPDATE") : false;

  const [drawer, setDrawer] = useState<Drawer>(null);
  const [status, setStatus] = useState<ItemStatusFilter>("active");
  // `qDraft` is what the user types; `q` is the applied term (Apply / Enter commit it).
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ column: "code", direction: "asc" });
  const [statusTarget, setStatusTarget] = useState<{
    item: Item;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  // Toggle a column's sort: click a new column → asc; click the active one → flip.
  function toggleSort(column: SortColumn) {
    setSort((s) =>
      s.column === column
        ? { column, direction: s.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  // Reset to page 1 whenever an applied filter changes.
  useEffect(() => setPage(1), [status, q]);

  const query = useItemsList({
    isActive: status === "active" ? true : undefined,
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const accountsQuery = useAccounts();
  const account = useMemo<(id: string | null) => AccountRef | null>(() => {
    const map = new Map((accountsQuery.data ?? []).map((a) => [a.id, { code: a.code, name: a.name }]));
    return (id) => (id ? (map.get(id) ?? null) : null);
  }, [accountsQuery.data]);

  const hasFilters = status !== "active" || q !== "";
  const rows = query.data?.data;
  // Client-side sort of the current page by the active column (the API is unsorted).
  const sortedRows = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    const key = (it: Item) => (sort.column === "code" ? it.code : (it.hsCode ?? ""));
    return [...(rows ?? [])].sort((a, b) =>
      key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: "base" }) * dir,
    );
  }, [rows, sort]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  function applyFilters() {
    setQ(qDraft.trim());
  }

  function clearFilters() {
    setStatus("active");
    setQDraft("");
    setQ("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Master Data" }, { label: "Items" }]} />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Items</h1>
        </div>
        {canManage && (
          <Button
            className="h-[38px] flex-none px-4"
            onClick={() => setDrawer({ kind: "create" })}
            data-testid="new-item"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New item
          </Button>
        )}
      </div>

      <div className="mt-4">
        <ItemFilterBar
          status={status}
          onStatus={setStatus}
          q={qDraft}
          onQ={setQDraft}
          onApply={applyFilters}
          onClear={clearFilters}
        />
      </div>

      <Card className="mt-4 overflow-hidden p-3 sm:p-4">
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
        ) : sortedRows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No items match these filters."
              description="Try a different status or search term."
              action={
                <Button variant="outline" onClick={clearFilters} data-testid="items-clear">
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No items yet."
              description="Add materials and items to use them in purchases, requisitions, and stock entries."
              action={
                canManage ? (
                  <Button onClick={() => setDrawer({ kind: "create" })} data-testid="empty-new-item">
                    <Plus className="h-4 w-4" aria-hidden />
                    New item
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <ItemsTable
              items={sortedRows}
              account={account}
              canManage={canManage}
              sort={sort}
              onSort={toggleSort}
              onEdit={(item) => setDrawer({ kind: "edit", item })}
              onDeactivate={(item) => setStatusTarget({ item, mode: "deactivate" })}
              onReactivate={(item) => setStatusTarget({ item, mode: "reactivate" })}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {rangeFrom}–{rangeTo}
                </span>{" "}
                of <span className="font-semibold text-foreground">{total}</span> item
                {total === 1 ? "" : "s"}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
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

      {drawer && (
        <ItemFormDrawer
          mode={drawer.kind === "edit" ? { kind: "edit", item: drawer.item } : { kind: "create" }}
          canManage={canManage}
          onClose={() => setDrawer(null)}
          onSuccess={(m) => {
            toast(m, "success");
            query.refetch();
          }}
          onConflict={() => {
            setDrawer(null);
            toast("This item was changed by someone else. Reload and try again.", "error");
            query.refetch();
          }}
          onError={(m) => toast(m, "error")}
        />
      )}

      <ItemStatusDialog
        item={statusTarget?.item ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
        onReload={() => query.refetch()}
      />
    </div>
  );
}
