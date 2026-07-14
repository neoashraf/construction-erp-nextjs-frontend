"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, PackageOpen, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteGrn } from "../access";
import { useGrns } from "../hooks/useGrnList";
import { useProjectOptions, useSupplierOptions } from "../hooks/usePoOptions";
import { GrnListFilterBar, EMPTY_GRN_FILTER, type GrnFilter } from "./GrnListFilterBar";
import { GrnList, type GrnNameMaps } from "./GrnList";
import { type GrnListFilter } from "../api/grns";

function apiDate(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const d = parseDate(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

function toApi(f: GrnFilter, page: number): GrnListFilter {
  return {
    projectId: f.projectId || undefined,
    supplierId: f.supplierId || undefined,
    status: f.status || undefined,
    purchaseOrderId: f.purchaseOrderId || undefined,
    purchaseBillId: f.purchaseBillId || undefined,
    grnRefNo: f.grnRefNo || undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    page,
  };
}

function isFiltered(f: GrnFilter): boolean {
  return !!(
    f.projectId ||
    f.supplierId ||
    f.status ||
    f.purchaseOrderId ||
    f.purchaseBillId ||
    f.grnRefNo ||
    f.dateFrom ||
    f.dateTo
  );
}

/**
 * GRN list screen (brief §Scope 3; spec §4). Filterable, paginated register with
 * the standard state matrix: loading · error+retry · two empties · offline banner
 * · default (dimmed when a background fetch is in flight). Server scopes PM to
 * assigned projects; the "New GRN" CTA is hidden for actors without
 * `purchase.grn:CREATE` (Store Keeper only per spec §11).
 */
export function GrnListScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canCreate = canWriteGrn(user);
  const [applied, setApplied] = useState<GrnFilter>(EMPTY_GRN_FILTER);
  const [page, setPage] = useState(1);

  const query = useGrns(toApi(applied, page));
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);

  const projectsData = useProjectOptions().data;
  const suppliersData = useSupplierOptions().data;

  const maps: GrnNameMaps = useMemo(
    () => ({
      projects: new Map((projectsData ?? []).map((p) => [p.id, p])),
      suppliers: new Map((suppliersData ?? []).map((s) => [s.id, s])),
    }),
    [projectsData, suppliersData],
  );

  function apply(f: GrnFilter) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_GRN_FILTER);
  }

  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb items={[{ label: "Purchase" }, { label: "Goods receipt" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="grn-list-title">
          Goods receipt
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} GRN{total === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canCreate && (
          <Button size="md" asChild className="ml-auto gap-1.5" data-testid="grn-new">
            <Link href="/purchase/grn/new">
              <Plus className="h-4 w-4" aria-hidden />
              New GRN
            </Link>
          </Button>
        )}
      </div>

      {!online && (
        <Alert tone="warning" className="mb-3" title="You're offline. Showing the last loaded GRNs.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Filters are paused until you reconnect.
          </span>
        </Alert>
      )}

      <GrnListFilterBar
        applied={applied}
        projects={projectsData ?? []}
        suppliers={suppliersData ?? []}
        onApply={apply}
        onClear={clear}
      />

      <Card
        className={cn(
          "mt-4 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="grn-loading">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load goods receipts. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="grn-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="grn-empty-filtered">
              <EmptyState
                icon={PackageOpen}
                title="No goods receipts match your filters."
                description="Try a wider date range or a different supplier."
                action={
                  <Button size="md" variant="outline" onClick={clear} data-testid="grn-empty-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8" data-testid="grn-empty-firstuse">
              <EmptyState
                icon={PackageOpen}
                title="No goods receipts yet."
                description="Record what's arrived at the godown against a PO or a Bill."
                action={
                  canCreate ? (
                    <Button size="md" asChild data-testid="grn-empty-new">
                      <Link href="/purchase/grn/new">New GRN</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <GrnList rows={rows} maps={maps} />
        )}

        {query.data && rows.length > 0 && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="grn-count">
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
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="grn-prev"
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page * query.data.pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                data-testid="grn-next"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
