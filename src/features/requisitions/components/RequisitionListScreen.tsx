"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteRequisition } from "../access";
import { useRequisitions } from "../hooks/useRequisitions";
import { useCostCentreOptions, useProjectOptions, useUserOptions } from "../hooks/useRequisitionOptions";
import { RequisitionFilterBar, EMPTY_REQ_FILTER, type RequisitionFilter } from "./RequisitionFilterBar";
import { RequisitionList, type ReqNameMaps } from "./RequisitionList";
import { type RequisitionListFilter } from "../api/requisition";
import { parseDate } from "@/lib/format";

function apiDate(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const d = parseDate(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

function toApi(f: RequisitionFilter, meId: string, page: number): RequisitionListFilter {
  return {
    status: f.status || undefined,
    priority: f.priority || undefined,
    projectId: f.projectId || undefined,
    costCentreId: f.costCentreId || undefined,
    submittedById: f.mine ? meId : undefined,
    requiredFrom: apiDate(f.requiredFrom),
    requiredTo: apiDate(f.requiredTo),
    hasOutstanding: f.hasOutstanding || undefined,
    page,
  };
}

function isFiltered(f: RequisitionFilter): boolean {
  return (
    !!f.status || !!f.priority || !!f.projectId || !!f.costCentreId || f.mine || !!f.requiredFrom || !!f.requiredTo || f.hasOutstanding
  );
}

/**
 * Requisition list screen (spec §4.list/§6). Filterable, paginated register across the seven
 * lifecycle states. Read for all REQ-scoped roles; the "New requisition" CTA + mobile FAB are
 * hidden for actors without write scope (PM/Site Engineer/Admin). Full state matrix: loading ·
 * error+retry · two empties (filtered vs first-use) · offline banner · default.
 */
export function RequisitionListScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canCreate = canWriteRequisition(user);
  const [applied, setApplied] = useState<RequisitionFilter>(EMPTY_REQ_FILTER);
  const [page, setPage] = useState(1);

  const query = useRequisitions(toApi(applied, user.id, page));
  const rows = query.data?.data ?? [];

  const projectsData = useProjectOptions().data;
  const costCentres = useCostCentreOptions().data ?? [];
  const usersData = useUserOptions().data;
  const projects = projectsData ?? [];

  const maps: ReqNameMaps = useMemo(
    () => ({
      projects: new Map((projectsData ?? []).map((p) => [p.id, p])),
      users: new Map((usersData ?? []).map((u) => [u.id, u])),
    }),
    [projectsData, usersData],
  );

  function apply(f: RequisitionFilter) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_REQ_FILTER);
  }

  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Requisitions" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="req-list-title">
          Requisitions
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} requisition{total === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canCreate && (
          <Button size="md" asChild className="ml-auto gap-1.5" data-testid="req-new">
            <Link href="/requisitions/new">
              <Plus className="h-4 w-4" aria-hidden />
              New requisition
            </Link>
          </Button>
        )}
      </div>

      {!online && (
        <Alert tone="warning" className="mb-3" title="You're offline. Showing the last loaded requisitions.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Filters are paused until you reconnect.
          </span>
        </Alert>
      )}

      <RequisitionFilterBar applied={applied} projects={projects} costCentres={costCentres} onApply={apply} onClear={clear} />

      <Card className={cn("mt-4 flex flex-col overflow-hidden", query.isFetching && !query.isLoading && "opacity-60")}>
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="req-loading">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load requisitions. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="req-retry">Retry</Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="req-empty-filtered">
              <EmptyState
                icon={ClipboardList}
                title="No requisitions match these filters."
                description="Try a wider date range or a different status."
                action={<Button size="md" variant="outline" onClick={clear} data-testid="req-empty-clear">Clear filters</Button>}
              />
            </div>
          ) : (
            <div className="p-8" data-testid="req-empty-firstuse">
              <EmptyState
                icon={ClipboardList}
                title="You haven't raised any requisitions yet."
                description="Raise a material request for a project to get started."
                action={
                  canCreate ? (
                    <Button size="md" asChild data-testid="req-empty-new">
                      <Link href="/requisitions/new">New requisition</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <RequisitionList rows={rows} maps={maps} />
        )}

        {query.data && rows.length > 0 && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="req-count">
              Showing <span className="font-semibold text-foreground">{(page - 1) * query.data.pageSize + 1}</span>–
              <span className="font-semibold text-foreground">{Math.min(page * query.data.pageSize, total)}</span> of{" "}
              <span className="font-semibold text-foreground">{total}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="req-prev">Prev</Button>
              <Button size="sm" variant="outline" disabled={page * query.data.pageSize >= total} onClick={() => setPage((p) => p + 1)} data-testid="req-next">Next</Button>
            </div>
          </div>
        )}
      </Card>

      {canCreate && (
        <Link
          href="/requisitions/new"
          data-testid="req-fab"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg lg:hidden"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New
        </Link>
      )}
    </div>
  );
}
