"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, PackageOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteDraft } from "../access";
import { useStockJournals } from "../hooks/useStockJournals";
import { useGodownOptions, useItemOptions, useProjectOptions, useUserOptions } from "../hooks/useInventoryOptions";
import { StockJournalFilterBar, EMPTY_SJ_FILTER, type StockJournalFilter } from "./StockJournalFilterBar";
import { StockJournalList, type NameMaps } from "./StockJournalList";
import { type StockJournalListFilter } from "../api/stock-journal";

function toApi(f: StockJournalFilter, page: number): StockJournalListFilter {
  return {
    status: f.status || undefined,
    mode: f.mode || undefined,
    projectId: f.projectId || undefined,
    godownId: f.godownId || undefined,
    itemId: f.itemId || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    page,
  };
}

function isFiltered(f: StockJournalFilter): boolean {
  return Object.values(f).some((v) => !!v);
}

/**
 * Stock Journal list screen (spec §4.A/§6). Filterable, paginated table of journals across
 * the four lifecycle states. Read for all INV-scoped roles; the "New Stock Journal" CTA is
 * hidden for actors without create scope (Store Keeper/Admin). Full state matrix: loading ·
 * error+retry · two empties (filtered vs first-use) · default.
 */
export function StockJournalListScreen() {
  const user = useAuthenticatedUser();
  const canCreate = canWriteDraft(user);
  const [applied, setApplied] = useState<StockJournalFilter>(EMPTY_SJ_FILTER);
  const [page, setPage] = useState(1);

  const query = useStockJournals(toApi(applied, page));
  const rows = query.data?.data ?? [];

  const projects = useProjectOptions().data ?? [];
  const godownsData = useGodownOptions().data;
  const itemsData = useItemOptions().data;
  const usersData = useUserOptions().data;
  const godowns = godownsData ?? [];
  const items = itemsData ?? [];

  const maps: NameMaps = useMemo(
    () => ({
      godowns: new Map((godownsData ?? []).map((g) => [g.id, g])),
      items: new Map((itemsData ?? []).map((i) => [i.id, i])),
      users: new Map((usersData ?? []).map((u) => [u.id, u])),
    }),
    [godownsData, itemsData, usersData],
  );

  function apply(f: StockJournalFilter) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_SJ_FILTER);
  }

  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Inventory" }, { label: "Stock Journal" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="sj-list-title">
          Stock Journal
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} journal{total === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canCreate && (
          <Button size="md" asChild className="ml-auto gap-1.5" data-testid="sj-new">
            <Link href="/inventory/stock-journals/new">
              <Plus className="h-4 w-4" aria-hidden />
              New Stock Journal
            </Link>
          </Button>
        )}
      </div>

      <StockJournalFilterBar applied={applied} projects={projects} godowns={godowns} items={items} onApply={apply} onClear={clear} />

      <Card className={cn("mt-4 flex flex-col overflow-hidden", query.isFetching && !query.isLoading && "opacity-60")}>
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="sj-loading">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load Stock Journals.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="sj-retry">Retry</Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="sj-empty-filtered">
              <EmptyState
                icon={PackageOpen}
                title="No Stock Journals match these filters."
                description="Try a wider date range or a different status."
                action={<Button size="md" variant="outline" onClick={clear} data-testid="sj-empty-clear">Clear filters</Button>}
              />
            </div>
          ) : (
            <div className="p-8" data-testid="sj-empty-firstuse">
              <EmptyState
                icon={PackageOpen}
                title="No Stock Journals yet for this project."
                description="Record a transfer, issue, or adjustment to get started."
                action={
                  canCreate ? (
                    <Button size="md" asChild data-testid="sj-empty-new">
                      <Link href="/inventory/stock-journals/new">New Stock Journal</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <StockJournalList rows={rows} maps={maps} />
        )}

        {query.data && rows.length > 0 && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="sj-count">
              Showing <span className="font-semibold text-foreground">{(page - 1) * query.data.pageSize + 1}</span>–
              <span className="font-semibold text-foreground">{Math.min(page * query.data.pageSize, total)}</span> of{" "}
              <span className="font-semibold text-foreground">{total}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="sj-prev">Prev</Button>
              <Button size="sm" variant="outline" disabled={page * query.data.pageSize >= total} onClick={() => setPage((p) => p + 1)} data-testid="sj-next">Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Site-facing floating New action (mobile) */}
      {canCreate && (
        <Link
          href="/inventory/stock-journals/new"
          data-testid="sj-fab"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg lg:hidden"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New
        </Link>
      )}
    </div>
  );
}
