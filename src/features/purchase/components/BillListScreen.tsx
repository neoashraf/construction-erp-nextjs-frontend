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
import { toDecimal } from "@/lib/money";
import { moneyWithSymbol } from "../format";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteBill } from "../access";
import { usePurchaseBills } from "../hooks/useBillList";
import { useProjectOptions, useSupplierOptions } from "../hooks/usePoOptions";
import { BillListFilterBar, EMPTY_BILL_FILTER, type BillFilter } from "./BillListFilterBar";
import { BillList, type BillNameMaps } from "./BillList";
import { Pager } from "./Pager";
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
    status: f.status.length ? f.status.join(",") : undefined,
    purchaseOrderId: f.purchaseOrderId || undefined,
    entryNo: f.entryNo || undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    page,
  };
}

function isFiltered(f: BillFilter): boolean {
  return !!(
    f.projectId ||
    f.supplierId ||
    f.status.length ||
    f.purchaseOrderId ||
    f.entryNo ||
    f.dateFrom ||
    f.dateTo
  );
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
    let net = toDecimal("0");
    let outstanding = toDecimal("0");
    for (const r of rows) {
      gross = gross.plus(toDecimal(r.grossAmount || "0"));
      net = net.plus(toDecimal(r.netPayableAmount || "0"));
      outstanding = outstanding.plus(toDecimal(r.outstandingAmount || "0"));
    }
    return {
      gross: gross.toFixed(4),
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
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="bill-list-title">
          Purchase bills
        </h1>
        {query.data ? (
          <span
            className="inline-flex h-[22px] items-center rounded-pill bg-accent-soft px-2.5 text-[11.5px] font-semibold text-accent-ink"
            data-testid="bill-list-count"
          >
            {total} total
          </span>
        ) : query.isLoading ? (
          <span
            className="inline-flex h-[22px] items-center rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground"
            data-testid="bill-list-count"
          >
            —
          </span>
        ) : null}
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
        <Card
          className="mt-4 grid grid-cols-2 overflow-hidden md:grid-cols-4"
          data-testid="bill-list-totals"
        >
          <TotalCard label="Bills in view" value={String(total)} kind="count" />
          <TotalCard label="Gross" value={totals.gross} />
          <TotalCard label="Net payable" value={totals.net} emphasise />
          <TotalCard label="Outstanding" value={totals.outstanding} tone="amber" />
        </Card>
      )}

      <Card
        className={cn(
          "mt-4 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {query.isLoading ? (
          <div data-testid="bill-loading">
            <div className="hidden items-center gap-2 border-b border-border-strong bg-surface-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground lg:flex">
              {[
                "Entry no",
                "Supplier",
                "Project",
                "Bill date",
                "Gross",
                "VAT input",
                "TDS / AIT",
                "Net payable",
                "Outstanding",
                "Status",
              ].map((h, i) => (
                <div key={i} className="flex-1">
                  {h}
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-b border-border px-4 py-3.5 last:border-b-0">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
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
                icon={FileText}
                iconTone="info"
                title="No purchase bills yet."
                description="Create a bill directly or from an approved PO."
                action={
                  canCreate ? (
                    <Button size="md" asChild className="gap-1.5" data-testid="bill-empty-new">
                      <Link href="/purchase/bills/new">
                        <Plus className="h-4 w-4" aria-hidden />
                        New bill
                      </Link>
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
            <Pager
              page={page}
              pageSize={query.data.pageSize}
              total={total}
              onPage={setPage}
              testidPrefix="bill"
            />
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * One totals-strip cell (Purchase Bill.dc.html list header): Bills in view · Gross · Net
 * payable · Outstanding. The four cells share a single connected card — dividers separate
 * them (a top border on the wrapped 2nd row at <md, a left border between columns), with no
 * gaps. Outstanding renders amber, Net payable is emphasised, and the count cell shows a
 * plain integer (no ৳).
 */
function TotalCard({
  label,
  value,
  emphasise,
  tone,
  kind,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
  tone?: "amber";
  kind?: "count";
}) {
  return (
    <div className="min-w-0 border-border px-4 py-3 [&:not(:nth-child(-n+2))]:border-t [&:nth-child(even)]:border-l md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-t-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono tabular-nums",
          tone === "amber" ? "text-warning-ink" : "text-foreground",
          emphasise ? "text-[18px] font-bold" : "text-[15px] font-semibold",
        )}
      >
        {kind === "count" ? value : moneyWithSymbol(value)}
      </div>
    </div>
  );
}
