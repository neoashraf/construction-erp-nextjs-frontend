"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, FileText, PackageOpen, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWritePo } from "../access";
import { usePurchaseOrders } from "../hooks/usePoList";
import { useProjectOptions, useSupplierOptions } from "../hooks/usePoOptions";
import { PoListFilterBar, EMPTY_PO_FILTER, type PoFilter } from "./PoListFilterBar";
import { PoList, type PoNameMaps } from "./PoList";
import { Pager } from "./Pager";
import { type PurchaseOrderListFilter } from "../api/orders";

function apiDate(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const d = parseDate(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

function toApi(f: PoFilter, page: number): PurchaseOrderListFilter {
  return {
    projectId: f.projectId || undefined,
    supplierId: f.supplierId || undefined,
    // Contract accepts a csv of status enum values (GET /orders ?status=).
    status: f.status.length ? f.status.join(",") : undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    page,
  };
}

function isFiltered(f: PoFilter): boolean {
  return !!(f.projectId || f.supplierId || f.status.length || f.dateFrom || f.dateTo);
}

/**
 * Purchase Orders list screen (brief §Scope 3; spec §4.list/§6; FR-PUR-001/-002). Filterable,
 * paginated register. Read for all PUR-scoped roles; the server scopes PM to assigned
 * projects. The "New PO" CTA + mobile FAB are hidden for actors without `purchase:write`.
 * Full state matrix: loading · error+retry · two empties (filtered vs first-use) · offline
 * banner · default (dimmed when a background fetch is in flight).
 */
export function PoListScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canCreate = canWritePo(user);
  const [applied, setApplied] = useState<PoFilter>(EMPTY_PO_FILTER);
  const [page, setPage] = useState(1);

  const query = usePurchaseOrders(toApi(applied, page));
  const rows = query.data?.data ?? [];

  const projectsData = useProjectOptions().data;
  const suppliersData = useSupplierOptions().data;
  const projects = projectsData ?? [];
  const suppliers = suppliersData ?? [];

  const maps: PoNameMaps = useMemo(
    () => ({
      projects: new Map((projectsData ?? []).map((p) => [p.id, p])),
      suppliers: new Map((suppliersData ?? []).map((s) => [s.id, s])),
    }),
    [projectsData, suppliersData],
  );

  function apply(f: PoFilter) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_PO_FILTER);
  }

  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="po-list-title">
          Purchase orders
        </h1>
        {query.data ? (
          <span
            className="inline-flex h-[22px] items-center rounded-pill bg-accent-soft px-2.5 text-[11.5px] font-semibold text-accent-ink"
            data-testid="po-list-count"
          >
            {total} total
          </span>
        ) : query.isLoading ? (
          <span
            className="inline-flex h-[22px] items-center rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground"
            data-testid="po-list-count"
          >
            —
          </span>
        ) : null}
        {canCreate && (
          <Button size="md" asChild className="ml-auto gap-1.5" data-testid="po-new">
            <Link href="/purchase/orders/new">
              <Plus className="h-4 w-4" aria-hidden />
              New PO
            </Link>
          </Button>
        )}
      </div>

      {!online && (
        <Alert tone="warning" className="mb-3" title="You're offline. Showing the last loaded purchase orders.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Filters are paused until you reconnect.
          </span>
        </Alert>
      )}

      <PoListFilterBar applied={applied} projects={projects} suppliers={suppliers} onApply={apply} onClear={clear} />

      <Card className={cn("mt-4 flex flex-col overflow-hidden", query.isFetching && !query.isLoading && "opacity-60")}>
        {query.isLoading ? (
          <div data-testid="po-loading">
            <div className="hidden border-b border-border-strong bg-surface-2 px-4 py-3 lg:grid lg:grid-cols-[minmax(120px,1.2fr)_minmax(140px,1.4fr)_minmax(140px,1.4fr)_110px_130px_150px_44px] lg:gap-2">
              {["PO ref no", "Project", "Supplier", "PO date", "Expected delivery", "Status", ""].map(
                (h, i) => (
                  <div
                    key={i}
                    className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
                  >
                    {h}
                  </div>
                ),
              )}
            </div>
            <div className="flex flex-col">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-b border-muted px-4 py-3.5">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load purchase orders. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="po-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="po-empty-filtered">
              <EmptyState
                icon={PackageOpen}
                title="No purchase orders match your filters."
                description="Try a wider date range or a different supplier."
                action={
                  <Button size="md" variant="outline" onClick={clear} data-testid="po-empty-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8" data-testid="po-empty-firstuse">
              <EmptyState
                icon={FileText}
                iconTone="info"
                title="No purchase orders yet."
                description="Create your first PO to start the procurement flow."
                action={
                  canCreate ? (
                    <Button size="md" asChild className="gap-1.5" data-testid="po-empty-new">
                      <Link href="/purchase/orders/new">
                        <Plus className="h-4 w-4" aria-hidden />
                        New PO
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <PoList rows={rows} maps={maps} />
        )}

        {query.data && rows.length > 0 && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="po-count">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {(page - 1) * query.data.pageSize + 1}
              </span>
              –
              <span className="font-semibold text-foreground">
                {Math.min(page * query.data.pageSize, total)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{total}</span>
            </span>
            <Pager
              page={page}
              pageSize={query.data.pageSize}
              total={total}
              onPage={setPage}
              testidPrefix="po"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
