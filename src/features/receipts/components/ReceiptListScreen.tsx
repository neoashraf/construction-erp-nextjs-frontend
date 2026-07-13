"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Receipt as ReceiptIcon, WifiOff, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteReceipt, canPrintReceipt } from "../access";
import { useReceipts } from "../hooks/useReceiptList";
import { useCustomerOptions, useIpcOptions, useProjectOptions } from "../hooks/useReceiptOptions";
import {
  EMPTY_RECEIPT_FILTER,
  ReceiptListFilterBar,
  type ReceiptFilterValues,
} from "./ReceiptListFilterBar";
import { ReceiptList, type ReceiptNameMaps } from "./ReceiptList";
import { IpcContextChip } from "./IpcContextChip";
import { type ReceiptListFilter } from "../api/receipt";

function apiDate(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const d = parseDate(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

function toApi(f: ReceiptFilterValues, page: number): ReceiptListFilter {
  return {
    entryNo: f.entryNo || undefined,
    receiptType: f.receiptType || undefined,
    customerId: f.customerId || undefined,
    projectId: f.projectId || undefined,
    ipcId: f.ipcId || undefined,
    status: f.status.length > 0 ? f.status.join(",") : undefined,
    paymentMode: f.paymentMode.length > 0 ? f.paymentMode.join(",") : undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    page,
  };
}

function isFiltered(f: ReceiptFilterValues): boolean {
  return !!(
    f.entryNo ||
    f.receiptType ||
    f.customerId ||
    f.projectId ||
    f.ipcId ||
    f.status.length > 0 ||
    f.paymentMode.length > 0 ||
    f.dateFrom ||
    f.dateTo
  );
}

function rangeStart(page: number, pageSize: number, total: number): number {
  return total === 0 ? 0 : (page - 1) * pageSize + 1;
}
function rangeEnd(page: number, pageSize: number, total: number): number {
  return Math.min(page * pageSize, total);
}

/**
 * Receipt list screen (brief fe-receipt-list §Scope; spec §4/§6/§9/§11). The
 * Accounts Manager's read-only collection register — one list surfacing both
 * IPC-linked and general receipts. No ledger mutation happens here (spec §6
 * "Saving/posting: N/A — read-only list"); a row routes to the editor (DRAFT) or
 * the viewer (POSTED/CANCELLED), both owned by FE-43/FE-44.
 */
export function ReceiptListScreen({ initialIpcId = "" }: { initialIpcId?: string } = {}) {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canCreate = canWriteReceipt(user);
  const canPrint = canPrintReceipt(user);

  const [applied, setApplied] = useState<ReceiptFilterValues>(() => ({
    ...EMPTY_RECEIPT_FILTER,
    ipcId: initialIpcId,
  }));
  const [ipcDismissed, setIpcDismissed] = useState(false);
  const [page, setPage] = useState(1);

  const query = useReceipts(toApi(applied, page));
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);

  const projectsData = useProjectOptions().data;
  const customersData = useCustomerOptions().data;
  const ipcsData = useIpcOptions().data;

  const maps: ReceiptNameMaps = useMemo(
    () => ({
      projects: new Map((projectsData ?? []).map((p) => [p.id, p])),
      customers: new Map((customersData ?? []).map((c) => [c.id, c])),
      ipcs: new Map((ipcsData ?? []).map((i) => [i.id, i.entryNo])),
    }),
    [projectsData, customersData, ipcsData],
  );

  const err = query.isError ? asApiError(query.error) : null;
  const forbidden = (err?.code === "FORBIDDEN" || err?.status === 403) && !!applied.projectId;

  function apply(f: ReceiptFilterValues) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setIpcDismissed(true);
    setApplied(EMPTY_RECEIPT_FILTER);
  }
  function dismissIpcChip() {
    setIpcDismissed(true);
    setPage(1);
    setApplied((prev) => ({ ...prev, ipcId: "" }));
  }

  const total = query.data?.total ?? 0;
  const showIpcChip = !!applied.ipcId && !ipcDismissed;

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb items={[{ label: "Receipts" }, { label: "All receipts" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="receipt-list-title">
          Receipts
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} receipt{total === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canCreate && (
          <Button
            size="md"
            asChild
            className="ml-auto gap-1.5"
            disabled={!online}
            data-testid="receipt-new"
          >
            <Link href="/receipts/new">
              <Plus className="h-4 w-4" aria-hidden />
              New receipt
            </Link>
          </Button>
        )}
      </div>

      {!online && (
        <Alert
          tone="warning"
          className="mb-3"
          title="You're offline. Showing the last loaded receipts."
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Filters are paused until you reconnect.
          </span>
        </Alert>
      )}

      <ReceiptListFilterBar
        applied={applied}
        projects={projectsData ?? []}
        customers={customersData ?? []}
        fyLabel="FY 2025–26"
        offline={!online}
        onApply={apply}
        onClear={clear}
      />

      {showIpcChip && (
        <IpcContextChip
          label={maps.ipcs.get(applied.ipcId) ?? applied.ipcId}
          onDismiss={dismissIpcChip}
        />
      )}

      <Card
        className={cn(
          "mt-4 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {forbidden ? (
          <div className="p-8" data-testid="receipt-forbidden">
            <EmptyState
              icon={Lock}
              title="You can only view your assigned projects."
              description="Project managers see receipts for their assigned projects only."
            />
          </div>
        ) : query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="receipt-loading">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load receipts. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="receipt-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="receipt-empty-filtered">
              <EmptyState
                icon={ReceiptIcon}
                title="No receipts match these filters."
                description="Try a wider date range or a different status."
                action={
                  <Button
                    size="md"
                    variant="outline"
                    onClick={clear}
                    data-testid="receipt-empty-clear"
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8" data-testid="receipt-empty-firstuse">
              <EmptyState
                icon={ReceiptIcon}
                title="No receipts recorded yet."
                description="Record your first customer collection — against an IPC or as a general receipt."
                action={
                  canCreate ? (
                    <Button size="md" asChild data-testid="receipt-empty-new">
                      <Link href="/receipts/new">New receipt</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <ReceiptList rows={rows} maps={maps} canPrint={canPrint} />
        )}

        {query.data && rows.length > 0 && !forbidden && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="receipt-count">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {rangeStart(page, query.data.pageSize, total)}
              </span>
              –
              <span className="font-semibold text-foreground">
                {rangeEnd(page, query.data.pageSize, total)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{total}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="receipt-prev"
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page * query.data.pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                data-testid="receipt-next"
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
