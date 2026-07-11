"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Wallet, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { hasGrant } from "@/lib/auth/roles";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { useBudgetVsActual } from "../hooks/useBudgetVsActual";
import {
  useCostCentreOptions,
  useFinancialYearOptions,
  useProjectOptions,
} from "../hooks/useCostControlOptions";
import { BudgetVsActualFilterBar, emptyFilter } from "./BudgetVsActualFilterBar";
import { BudgetVsActualTable, type GroupLabel } from "./BudgetVsActualTable";
import { ViewModeToggle } from "./ViewModeToggle";
import {
  BVA_STATUSES,
  statusToApi,
  type BudgetVsActualFilterFormValues,
} from "../schemas/budget-vs-actual.schema";
import { type BudgetVsActualQuery } from "../api/budget-vs-actual";
import { type BudgetVsActualRow, type ViewMode } from "../types";

/** Track browser online/offline (spec §6). */
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

function toApiQuery(form: BudgetVsActualFilterFormValues, page: number): BudgetVsActualQuery {
  return {
    projectId: form.viewMode === "project" ? form.projectId || undefined : undefined,
    costCentreId: form.viewMode === "cost_centre" ? form.costCentreId || undefined : undefined,
    financialYearId: form.financialYearId || undefined,
    dateFrom: form.dateFrom || undefined,
    dateTo: form.dateTo || undefined,
    status: statusToApi(form.status),
    page,
  };
}

/**
 * Budget-vs-actual monitor (FR-CC-006/007/008/011/012/015/016; spec). READ-ONLY — a
 * query over the LED ledger + MAS budgets, per (project, cost centre). Two view modes
 * (by project / by cost centre) swap the grouping column; the fixed selector is required
 * and gates the query (Apply-only). Full state matrix (spec §6): default · loading ·
 * two empty variants · partial (unresolved name) · error+retry · 403 project-scope ·
 * offline. No mutating action — CC never writes.
 */
export function BudgetVsActualScreen({
  initialContext,
}: {
  /** Deep-link seed (e.g. the Over-budget alerts "View in Budget vs Actual" drill) — pre-fills
   *  the fixed selector and auto-applies. Absent → the normal pick-context gate (no auto-fetch). */
  initialContext?: { projectId?: string; costCentreId?: string };
} = {}) {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canEditBudget = hasGrant(user, "master_data.projects", "UPDATE");

  const seedProjectId = initialContext?.projectId ?? "";
  const seedCostCentreId = initialContext?.costCentreId ?? "";
  const seedMode: ViewMode = seedProjectId ? "project" : seedCostCentreId ? "cost_centre" : "project";

  const [mode, setMode] = useState<ViewMode>(seedMode);
  const [applied, setApplied] = useState<BudgetVsActualFilterFormValues>(() => {
    if (seedProjectId) return { ...emptyFilter("project", ""), projectId: seedProjectId };
    if (seedCostCentreId) return { ...emptyFilter("cost_centre", ""), costCentreId: seedCostCentreId };
    return emptyFilter("project", "");
  });
  const [page, setPage] = useState(1);

  const projectsQuery = useProjectOptions();
  const costCentresQuery = useCostCentreOptions();
  const fyQuery = useFinancialYearOptions();
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const costCentres = useMemo(() => costCentresQuery.data ?? [], [costCentresQuery.data]);
  const financialYears = useMemo(() => fyQuery.data ?? [], [fyQuery.data]);

  const hasContext = mode === "project" ? !!applied.projectId : !!applied.costCentreId;
  const query = useBudgetVsActual(toApiQuery(applied, page), hasContext && online);
  const rows = query.data?.data ?? [];

  const err = query.isError ? asApiError(query.error) : null;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const projectScopeError =
    forbidden && applied.projectId ? "You don't have access to this project." : null;

  // Name resolution for the grouping column (partial state → id + "(name unavailable)").
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const costCentreName = useMemo(() => new Map(costCentres.map((c) => [c.id, c])), [costCentres]);
  const groupHeader = mode === "project" ? "Cost centre" : "Project";
  function groupLabelFor(row: BudgetVsActualRow): GroupLabel {
    if (mode === "project") {
      const c = costCentreName.get(row.costCentreId);
      if (!c) return { label: row.costCentreId, unresolved: true, inactive: false };
      return { label: `${c.code} — ${c.name}`, unresolved: false, inactive: !c.isActive };
    }
    const p = projectName.get(row.projectId);
    if (!p) return { label: row.projectId, unresolved: true, inactive: false };
    return { label: p.projectCode ? `${p.projectCode} — ${p.name}` : p.name, unresolved: false, inactive: false };
  }

  function changeMode(next: ViewMode) {
    if (next === mode) return;
    setMode(next);
    setApplied(emptyFilter(next, ""));
    setPage(1);
  }
  function apply(values: BudgetVsActualFilterFormValues) {
    setPage(1);
    setApplied(values);
  }
  function clear() {
    setPage(1);
    setApplied(emptyFilter(mode, ""));
  }

  const statusNarrowed = applied.status.length > 0 && applied.status.length < BVA_STATUSES.length;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Cost Control" }, { label: "Budget vs Actual" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="bva-title">
          Budget vs Actual
        </h1>
        <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="text-[11.5px] font-semibold text-muted-foreground">Read-only monitor</span>
        </span>
        <div className="ml-auto">
          <ViewModeToggle value={mode} onChange={changeMode} />
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="bva-offline">
          Budget-vs-actual figures may be out of date. Applying filters is disabled until you reconnect.
        </Alert>
      )}

      <BudgetVsActualFilterBar
        key={mode}
        mode={mode}
        defaults={applied}
        projects={projects}
        costCentres={costCentres}
        financialYears={financialYears}
        optionsLoading={mode === "project" ? projectsQuery.isLoading : costCentresQuery.isLoading}
        offline={!online}
        projectScopeError={projectScopeError}
        onApply={apply}
        onClear={clear}
      />

      <Card className="mt-4 flex flex-col overflow-hidden">
        <div className={cn("min-h-0 overflow-auto", query.isFetching && !query.isLoading && "opacity-60")}>
          {!hasContext ? (
            <div className="p-8" data-testid="bva-pick-context">
              <EmptyState
                icon={SlidersHorizontal}
                title={mode === "project" ? "Select a project to begin." : "Select a cost centre to begin."}
                description={
                  mode === "project"
                    ? "Choose a project above, then Apply to see budget vs actual across its cost centres."
                    : "Choose a cost centre above, then Apply to see it across projects."
                }
              />
            </div>
          ) : projectScopeError ? (
            <div className="p-8" data-testid="bva-forbidden">
              <EmptyState
                icon={Lock}
                title="You don't have access to this project."
                description="Project managers can only view budget vs actual for their assigned projects."
              />
            </div>
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2 p-4" data-testid="bva-loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <Alert tone="destructive" title="Couldn't load budget vs actual.">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="bva-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            </div>
          ) : rows.length === 0 ? (
            statusNarrowed ? (
              <div className="p-8" data-testid="bva-empty-filtered">
                <EmptyState
                  icon={Wallet}
                  title="No cost centres match this filter."
                  description="Try clearing the status filter or widening the date range."
                  action={
                    <Button size="md" variant="outline" onClick={clear} data-testid="bva-empty-clear">
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="p-8" data-testid="bva-empty-nobudgets">
                <EmptyState
                  icon={Wallet}
                  title="No budgets have been set for this project yet."
                  description="Budgets are managed in Projects → Budgets."
                  action={
                    canEditBudget ? (
                      <Button size="md" asChild data-testid="bva-go-budgets">
                        <Link href="/master-data/projects">Go to Budgets</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )
          ) : (
            <BudgetVsActualTable
              rows={rows}
              groupHeader={groupHeader}
              groupLabelFor={groupLabelFor}
              canEditBudget={canEditBudget}
            />
          )}
        </div>

        {query.data && rows.length > 0 && !query.isError && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="bva-count">
              Showing <span className="font-semibold text-foreground">{rangeStart(query.data.page, query.data.pageSize, query.data.total)}</span>–
              <span className="font-semibold text-foreground">{rangeEnd(query.data.page, query.data.pageSize, query.data.total)}</span> of{" "}
              <span className="font-semibold text-foreground">{query.data.total}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={query.data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="bva-prev"
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={query.data.page * query.data.pageSize >= query.data.total}
                onClick={() => setPage((p) => p + 1)}
                data-testid="bva-next"
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

function rangeStart(page: number, pageSize: number, total: number): number {
  return total === 0 ? 0 : (page - 1) * pageSize + 1;
}
function rangeEnd(page: number, pageSize: number, total: number): number {
  return Math.min(page * pageSize, total);
}
