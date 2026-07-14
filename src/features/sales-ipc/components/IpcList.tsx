"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, WifiOff, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { formatDate, parseDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteIpc } from "../access";
import { useIpcList } from "../hooks/useIpcList";
import { useCustomerOptions, useProjectOptions } from "../hooks/useIpcOptions";
import { IpcListFilterBar, EMPTY_IPC_FILTER, type IpcFilter } from "./IpcListFilterBar";
import { IpcStatusBadge } from "./IpcStatusBadge";
import { type IpcListFilter as ApiFilter } from "../api/ipc";
import { type IpcSummary } from "../types";

function apiDate(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const d = parseDate(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

function toApi(f: IpcFilter, page: number): ApiFilter {
  return {
    projectId: f.projectId || undefined,
    customerId: f.customerId || undefined,
    status: f.status || undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    page,
  };
}

function isFiltered(f: IpcFilter): boolean {
  return !!f.projectId || !!f.customerId || !!f.status || !!f.dateFrom || !!f.dateTo;
}

const GRID =
  "minmax(92px,1fr) minmax(100px,1.1fr) minmax(100px,1.1fr) 76px 84px 84px 80px 80px 84px 90px 28px";
const MONEY = "whitespace-nowrap font-mono text-[12px] tabular-nums";

function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

/**
 * IPC list screen (spec §4/§6; design "IPC list"). Filterable, paginated register across the
 * draft → posted → cancelled lifecycle. Read for Accounts + Admin (company-wide) and PM
 * (assigned projects, scoped server-side). The "New IPC" CTA + mobile FAB are hidden for actors
 * without write scope. Full state matrix: loading · error+retry · two empties (filtered vs
 * first-use) · offline banner · default. Rows open the editor (`/sales/ipcs/{id}`).
 */
export function IpcList() {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canCreate = canWriteIpc(user);
  const [applied, setApplied] = useState<IpcFilter>(EMPTY_IPC_FILTER);
  const [page, setPage] = useState(1);

  const query = useIpcList(toApi(applied, page));
  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  const projectsData = useProjectOptions().data;
  const customersData = useCustomerOptions().data;
  const projects = projectsData ?? [];
  const customers = customersData ?? [];

  const projectName = useMemo(() => new Map((projectsData ?? []).map((p) => [p.id, p.name])), [projectsData]);
  const customerName = useMemo(() => new Map((customersData ?? []).map((c) => [c.id, c.name])), [customersData]);

  function apply(f: IpcFilter) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_IPC_FILTER);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Sales / IPC" }, { label: "IPCs" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="ipc-list-title">IPC list</h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} IPC{total === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canCreate && (
          <Button size="md" asChild className="ml-auto gap-1.5" data-testid="ipc-new">
            <Link href="/sales/ipcs/new">
              <Plus className="h-4 w-4" aria-hidden />
              New IPC
            </Link>
          </Button>
        )}
      </div>

      {!online && (
        <Alert tone="warning" className="mb-3" title="You're offline. Showing the last loaded IPCs.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Filters are paused until you reconnect.
          </span>
        </Alert>
      )}

      <IpcListFilterBar applied={applied} projects={projects} customers={customers} onApply={apply} onClear={clear} />

      <Card className={cn("mt-4 flex flex-col overflow-hidden", query.isFetching && !query.isLoading && "opacity-60")}>
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="ipc-loading">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load IPCs. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="ipc-retry">Retry</Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="ipc-empty-filtered">
              <EmptyState
                icon={FileText}
                title="No IPCs match these filters."
                description="Try a wider date range or a different status."
                action={<Button size="md" variant="outline" onClick={clear} data-testid="ipc-empty-clear">Clear filters</Button>}
              />
            </div>
          ) : (
            <div className="p-8" data-testid="ipc-empty-firstuse">
              <EmptyState
                icon={FileText}
                title="No IPCs yet."
                description="Raise the first Interim Payment Certificate for a project."
                action={
                  canCreate ? (
                    <Button size="md" asChild data-testid="ipc-empty-new">
                      <Link href="/sales/ipcs/new">New IPC</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <IpcTable rows={rows} projectName={projectName} customerName={customerName} onOpen={(id) => router.push(`/sales/ipcs/${id}`)} />
        )}

        {query.data && rows.length > 0 && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="ipc-count">
              Showing <span className="font-semibold text-foreground">{(page - 1) * query.data.pageSize + 1}</span>–
              <span className="font-semibold text-foreground">{Math.min(page * query.data.pageSize, total)}</span> of{" "}
              <span className="font-semibold text-foreground">{total}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="ipc-prev">Prev</Button>
              <Button size="sm" variant="outline" disabled={page * query.data.pageSize >= total} onClick={() => setPage((p) => p + 1)} data-testid="ipc-next">Next</Button>
            </div>
          </div>
        )}
      </Card>

      {canCreate && (
        <Link
          href="/sales/ipcs/new"
          data-testid="ipc-fab"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg lg:hidden"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New
        </Link>
      )}
    </div>
  );
}

/** Outstanding cell: amber when owed, green ৳0.00 when settled+posted, "—" when cancelled. */
function OutstandingCell({ row }: { row: IpcSummary }) {
  if (row.status === "CANCELLED") return <span className="text-faint">—</span>;
  const owed = toDecimal(row.outstandingAmount).greaterThan(0);
  return (
    <span className={cn(MONEY, owed ? "text-warning-ink" : "text-success-ink")} aria-label={`Outstanding ৳ ${money(row.outstandingAmount)}`}>
      {money(row.outstandingAmount)}
    </span>
  );
}

function IpcTable({
  rows,
  projectName,
  customerName,
  onOpen,
}: {
  rows: IpcSummary[];
  projectName: Map<string, string>;
  customerName: Map<string, string>;
  onOpen: (id: string) => void;
}) {
  const proj = (id: string) => projectName.get(id) ?? `${id.slice(0, 8)} (name unavailable)`;
  const cust = (id: string) => customerName.get(id) ?? `${id.slice(0, 8)} (name unavailable)`;

  return (
    <div data-testid="ipc-list">
      {/* ≥lg table */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 970 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">Number</div>
            <div className="py-3">Project</div>
            <div className="py-3">Customer</div>
            <div className="py-3">IPC date</div>
            <div className="py-3 text-right">Certified ৳</div>
            <div className="py-3 text-right">Due ৳</div>
            <div className="py-3 text-right">Retained ৳</div>
            <div className="py-3 text-right">Adv rec ৳</div>
            <div className="py-3 text-right">Outstanding</div>
            <div className="py-3">Status</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              role="row"
              data-testid={`ipc-row-${r.status}`}
              className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
              style={{ gridTemplateColumns: GRID }}
              onClick={() => onOpen(r.id)}
            >
              <div className="min-w-0 py-3">
                {r.entryNo ? (
                  <Link href={`/sales/ipcs/${r.id}`} className="font-semibold text-accent-ink hover:underline" data-testid="ipc-open" onClick={(e) => e.stopPropagation()}>
                    {r.entryNo}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">Draft</span>
                )}
              </div>
              <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">{proj(r.projectId)}</div>
              <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">{cust(r.customerId)}</div>
              <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">{formatDate(r.ipcDate)}</div>
              <div className="py-3 text-right"><span className={MONEY}>{money(r.certifiedAmount)}</span></div>
              <div className="py-3 text-right"><span className={cn(MONEY, "font-semibold")}>{money(r.currentlyDueAmount)}</span></div>
              <div className="py-3 text-right"><span className={MONEY}>{money(r.retentionHeldAmount)}</span></div>
              <div className="py-3 text-right"><span className={MONEY}>{money(r.advanceRecoveredAmount)}</span></div>
              <div className="py-3 text-right"><OutstandingCell row={r} /></div>
              <div className="py-3"><IpcStatusBadge status={r.status} /></div>
              <div className="flex justify-end py-3" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Row actions"
                    className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="ipc-row-menu"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => onOpen(r.id)}>Open</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* <lg cards (read-only stacked) */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => (
          <Link key={r.id} href={`/sales/ipcs/${r.id}`} data-testid={`ipc-card-${r.status}`} className="border-b border-muted px-4 py-3 hover:bg-surface-2">
            <div className="flex items-start justify-between gap-2">
              {r.entryNo ? (
                <span className="font-semibold text-accent-ink">{r.entryNo}</span>
              ) : (
                <span className="inline-flex items-center rounded-pill bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">Draft</span>
              )}
              <IpcStatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">{cust(r.customerId)}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{proj(r.projectId)} · {formatDate(r.ipcDate)}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12px]">
              <LabelVal label="Certified" value={money(r.certifiedAmount)} />
              <LabelVal label="Currently due" value={money(r.currentlyDueAmount)} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LabelVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</div>
      <div className="font-mono text-[12px] tabular-nums text-foreground [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}
