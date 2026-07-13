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
import { formatMoney, toDecimal } from "@/lib/money";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteBill } from "../access";
import { usePurchaseBills } from "../hooks/useBillList";
import { useProjectOptions, useSupplierOptions } from "../hooks/usePoOptions";
import { BillListFilterBar, EMPTY_BILL_FILTER, type BillFilter } from "./BillListFilterBar";
import { BillList, type BillNameMaps } from "./BillList";
import { type PurchaseBillListFilter } from "../api/bills";

function apiDate(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const d = parseDate(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

function toApi(f: BillFilter, page: number): PurchaseBillListFilter {
  return {
    projectId: f.projectId || undefined,
    supplierId: f.supplierId || undefined,
    status: f.status || undefined,
    purchaseOrderId: f.purchaseOrderId || undefined,
    entryNo: f.entryNo || undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    page,
  };
}

function isFiltered(f: BillFilter): boolean {
  return !!(f.projectId || f.supplierId || f.status || f.purchaseOrderId || f.entryNo || f.dateFrom || f.dateTo);
}

/**
 * Purchase Bills list screen (brief §Scope 3; spec §4.list/§6). Filterable, paginated
 * register with a running-totals strip (Σ gross / VAT input / net payable / outstanding
 * for the visible page). Full state matrix: loading · error+retry · two empties · offline
 * banner · default (dimmed when a background fetch is in flight). Server scopes PM to
 * assigned projects; the "New bill" CTA is hidden for actors without `purchase:write`.
 */
export function BillListScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canCreate = canWriteBill(user);
  const [applied, setApplied] = useState<BillFilter>(EMPTY_BILL_FILTER);
  const [page, setPage] = useState(1);

  const query = usePurchaseBills(toApi(applied, page));
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);

  const projectsData = useProjectOptions().data;
  const suppliersData = useSupplierOptions().data;

  const maps: BillNameMaps = useMemo(
    () => ({
      projects: new Map((projectsData ?? []).map((p) => [p.id, p])),
      suppliers: new Map((suppliersData ?? []).map((s) => [s.id, s])),
    }),
    [projectsData, suppliersData],
  );

  const totals = useMemo(() => {
    let gross = toDecimal("0");
    let vat = toDecimal("0");
    let net = toDecimal("0");
    let outstanding = toDecimal("0");
    for (const r of rows) {
      gross = gross.plus(toDecimal(r.grossAmount || "0"));
      vat = vat.plus(toDecimal(r.vatInputAmount || "0"));
      net = net.plus(toDecimal(r.netPayableAmount || "0"));
      outstanding = outstanding.plus(toDecimal(r.outstandingAmount || "0"));
    }
    return {
      gross: gross.toFixed(4),
      vat: vat.toFixed(4),
      net: net.toFixed(4),
      outstanding: outstanding.toFixed(4),
    };
  }, [rows]);

  function apply(f: BillFilter) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_BILL_FILTER);
  }

  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb items={[{ label: "Purchase" }, { label: "Purchase bills" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="bill-list-title">
          Purchase bills
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} bill{total === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canCreate && (
          <Button size="md" asChild className="ml-auto gap-1.5" data-testid="bill-new">
            <Link href="/purchase/bills/new">
              <Plus className="h-4 w-4" aria-hidden />
              New bill
            </Link>
          </Button>
        )}
      </div>

      {!online && (
        <Alert tone="warning" className="mb-3" title="You're offline. Showing the last loaded bills.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Filters are paused until you reconnect.
          </span>
        </Alert>
      )}

      <BillListFilterBar
        applied={applied}
        projects={projectsData ?? []}
        suppliers={suppliersData ?? []}
        onApply={apply}
        onClear={clear}
      />

      {rows.length > 0 && !query.isLoading && (
        <div
          className="mt-4 grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-2 px-4 py-3 md:grid-cols-4"
          data-testid="bill-list-totals"
        >
          <Total label="Gross this page" value={totals.gross} />
          <Total label="VAT input this page" value={totals.vat} />
          <Total label="Net payable this page" value={totals.net} emphasise />
          <Total label="Outstanding this page" value={totals.outstanding} />
        </div>
      )}

      <Card
        className={cn(
          "mt-4 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="bill-loading">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load purchase bills. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="bill-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="bill-empty-filtered">
              <EmptyState
                icon={PackageOpen}
                title="No purchase bills match your filters."
                description="Try a wider date range or a different supplier."
                action={
                  <Button size="md" variant="outline" onClick={clear} data-testid="bill-empty-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8" data-testid="bill-empty-firstuse">
              <EmptyState
                icon={PackageOpen}
                title="No purchase bills yet."
                description="Create a bill directly or from an approved PO."
                action={
                  canCreate ? (
                    <Button size="md" asChild data-testid="bill-empty-new">
                      <Link href="/purchase/bills/new">New bill</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <BillList rows={rows} maps={maps} />
        )}

        {query.data && rows.length > 0 && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="bill-count">
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
                data-testid="bill-prev"
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page * query.data.pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                data-testid="bill-next"
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

function Total({
  label,
  value,
  emphasise,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono tabular-nums text-foreground",
          emphasise ? "text-[15px] font-bold" : "text-[13px] font-semibold",
        )}
      >
        {formatMoney(value)}
      </div>
    </div>
  );
}
