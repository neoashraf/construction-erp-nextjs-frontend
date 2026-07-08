"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb as UiBreadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { asApiError } from "@/lib/api/errors";
import { pageCount } from "@/lib/api/pagination";
import { cn } from "@/lib/utils";
import { useAuditLogs } from "../hooks/use-audit-logs";
import { useMinWidth } from "../lib/use-breakpoint";
import { EMPTY_AUDIT_LOG_FILTER, type AuditLogFilterFormValues } from "../schemas/audit-log-filter";
import { type AuditLogRow } from "../types";
import { AuditFilterBar } from "./AuditFilterBar";
import { AuditTable, type AuditSortKey, type SortDirection } from "./AuditTable";
import { AuditMobileCards } from "./AuditMobileCards";
import { AuditDiffPanel } from "./AuditDiffPanel";
import { AuditExportButton } from "./AuditExportButton";
import { AuditForbiddenView } from "./AuditForbiddenView";

const PAGE_SIZE = 25;

/** Track the browser's online/offline status (spec §6 offline banner). */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}

/**
 * The Audit log viewer (FR-AUD-020/021/022/023/024/026/027/028; screen spec, all
 * sections). Admin + AUD-READ gated (the route segment guard hides the nav slot;
 * this component also renders the inline 403 view for defence-in-depth, and the
 * backend re-checks every `/api/audit-logs*` call). READ-ONLY end to end — no
 * create/edit/delete/correct/verify affordance anywhere on this screen (FR-AUD-023).
 * The Export CTA is FULLY WIRED against the live `GET /api/audit-logs/export`
 * (the `aud-audit-log-export` backend follow-up has merged) — see
 * `AuditExportButton`. Full state matrix per spec §6.
 */
export function AuditLogScreen({ initialId = null }: { initialId?: string | null }) {
  const session = useSession();
  // Permission-driven (FE-21): the audit-log READ grant admits — Admin always has it,
  // and a custom role granted `audit.audit_log:READ` in Roles & permissions also gets
  // in. Falls back to Admin-only when the session has no permission projection. The
  // backend re-checks every /api/audit-logs* call (defence-in-depth).
  const canRead = session ? hasGrant(session, "audit.audit_log", "READ") : false;
  const online = useOnline();
  const router = useRouter();

  const [filter, setFilter] = useState<AuditLogFilterFormValues>(EMPTY_AUDIT_LOG_FILTER);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<AuditSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [openId, setOpenId] = useState<string | null>(initialId);

  useEffect(() => setOpenId(initialId), [initialId]);

  const isDesktop = useMinWidth(1024);

  function openDetail(row: AuditLogRow) {
    setOpenId(row.id);
    router.push(`/audit/log?id=${row.id}`, { scroll: false });
  }
  function closeDetail() {
    setOpenId(null);
    router.push("/audit/log", { scroll: false });
  }

  function applyFilter(next: AuditLogFilterFormValues) {
    setPage(1);
    setFilter(next);
  }
  function clearFilters() {
    setPage(1);
    setFilter(EMPTY_AUDIT_LOG_FILTER);
  }

  function toggleSort(key: AuditSortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  }

  const queryFilter = useMemo(
    () => ({
      userId: filter.userId || undefined,
      entityType: filter.entityType || undefined,
      entityId: filter.entityId || undefined,
      actions: filter.actions,
      projectId: filter.projectId || undefined,
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [filter, page],
  );

  const query = useAuditLogs(queryFilter, canRead);
  const result = query.data;

  const sortedRows = useMemo(
    () => sortRows(result?.data ?? [], sortKey, sortDirection),
    [result, sortKey, sortDirection],
  );

  const err = query.isError ? asApiError(query.error) : null;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;

  const hasFilters =
    !!filter.userId ||
    !!filter.entityType ||
    !!filter.entityId ||
    !!filter.projectId ||
    !!filter.dateFrom ||
    !!filter.dateTo ||
    filter.actions.length > 0;

  if (!canRead) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb />
        <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em]">Audit log</h1>
        <AuditForbiddenView />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb />
        <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em]">Audit log</h1>
        <AuditForbiddenView />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumb entryId={openId} />
          <div className="flex items-center gap-2.5">
            <h1 className="text-[23px] font-bold tracking-[-0.02em]">Audit log</h1>
            <Badge tone="neutral" dot>
              Read-only · append-only
            </Badge>
            <Badge tone="success" dot>
              Company-scoped
            </Badge>
          </div>
        </div>
        <AuditExportButton
          filter={{
            userId: filter.userId || undefined,
            entityType: filter.entityType || undefined,
            entityId: filter.entityId || undefined,
            actions: filter.actions,
            projectId: filter.projectId || undefined,
            dateFrom: filter.dateFrom || undefined,
            dateTo: filter.dateTo || undefined,
          }}
          count={result?.total ?? 0}
          offline={!online}
        />
      </div>

      {!online && (
        <Alert
          tone="warning"
          title="Can't reach the server. Check your connection and try again."
          className="mt-3"
          data-testid="audit-offline"
        >
          Showing the last loaded entries. Filters and export are disabled until you reconnect.
        </Alert>
      )}

      <div className="mt-4">
        <AuditFilterBar value={filter} onChange={applyFilter} offline={!online} />
      </div>

      <div className="mt-4">
        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              "min-h-0 overflow-auto",
              query.isFetching && !query.isLoading && "opacity-60",
            )}
          >
            {query.isLoading ? (
              <div className="flex flex-col gap-2 p-4" data-testid="audit-loading">
                {Array.from({ length: 11 }).map((_, i) => (
                  <Skeleton key={i} className="h-[54px] w-full" />
                ))}
              </div>
            ) : query.isError ? (
              <div className="p-4">
                <Alert tone="destructive" title="Couldn't load the audit log.">
                  <div className="flex flex-col items-start gap-2">
                    <span>Check your connection and try again.</span>
                    <Button size="sm" onClick={() => query.refetch()} data-testid="audit-retry">
                      Retry
                    </Button>
                  </div>
                </Alert>
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Search}
                  title="No audit entries match these filters."
                  action={
                    hasFilters ? (
                      <Button
                        size="md"
                        variant="outline"
                        onClick={clearFilters}
                        data-testid="audit-empty-clear"
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <>
                <AuditTable
                  rows={sortedRows}
                  selectedId={openId}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  onOpen={openDetail}
                />
                <AuditMobileCards rows={sortedRows} onOpen={openDetail} />
              </>
            )}
          </div>

          {result && sortedRows.length > 0 && !query.isError && (
            <div className="flex-none border-t border-border">
              <Pagination
                page={result.page}
                pageSize={result.pageSize}
                total={result.total}
                onPage={setPage}
              />
            </div>
          )}
        </Card>
      </div>

      {/* >=1024: side-panel Sheet overlay. <1024 (incl. mobile): full-width inline
          block (spec §4 — tablet gets a full-width diff; mobile notes the diff is
          "best on a larger screen" via `AuditMobileCards`, but still allows opening
          it since row taps in the mobile card list call the same `openDetail`). */}
      {openId && isDesktop && (
        <AuditDiffPanel
          id={openId}
          projectId={rowProjectId(sortedRows, openId)}
          onClose={closeDetail}
        />
      )}
      {openId && !isDesktop && (
        <div className="mt-4" data-testid="audit-diff-tablet">
          <AuditDiffPanel
            id={openId}
            projectId={rowProjectId(sortedRows, openId)}
            asSheet={false}
            onClose={closeDetail}
          />
        </div>
      )}
    </div>
  );
}

/** The visible row's `projectId` for the currently open detail, or null if not in view. */
function rowProjectId(rows: AuditLogRow[], id: string): string | null {
  return rows.find((r) => r.id === id)?.projectId ?? null;
}

function sortRows(rows: AuditLogRow[], key: AuditSortKey, direction: SortDirection): AuditLogRow[] {
  const sorted = [...rows].sort((a, b) => {
    const av = key === "createdAt" ? a.createdAt : key === "userId" ? a.userId : a.entityType;
    const bv = key === "createdAt" ? b.createdAt : key === "userId" ? b.userId : b.entityType;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  return direction === "asc" ? sorted : sorted.reverse();
}

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = pageCount({ total, pageSize });
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3" data-testid="audit-pagination">
      <span className="text-[12.5px] text-muted-foreground">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")}
        </span>{" "}
        of <span className="font-semibold text-foreground">{total.toLocaleString("en-IN")}</span> ·
        newest first
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Prev
          </Button>
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function Breadcrumb({ entryId }: { entryId?: string | null }) {
  return (
    <UiBreadcrumb
      items={[
        { label: "Admin" },
        { label: "Audit log", href: entryId ? "/audit/log" : undefined },
        ...(entryId ? [{ label: `entry ${entryId}` }] : []),
      ]}
    />
  );
}
