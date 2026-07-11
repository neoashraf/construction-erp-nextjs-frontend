"use client";

import { useMemo, useState } from "react";
import { Lock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { hasGrant, roleMatches } from "@/lib/auth/roles";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { useProfitability } from "../hooks/useProfitability";
import { useOnline } from "../hooks/useOnline";
import { useCostCentreOptions, useFinancialYearOptions, useProjectOptions } from "../hooks/useCostControlOptions";
import { ProfitabilityFilterBar } from "./ProfitabilityFilterBar";
import { ProfitabilityTable, type CellLabel, type ProfitSort } from "./ProfitabilityTable";
import { GroupingModeControl } from "./GroupingModeControl";
import { type ProfitabilityQuery } from "../api/profitability";
import {
  emptyProfitabilityFilter,
  type ProfitabilityFilterFormValues,
} from "../schemas/profitability.schema";
import { type ProfitabilityRow, type ProfitGroupBy } from "../types";

/**
 * Only Admin + Accounts Manager may read profitability (spec §11, Open item 1 — the SRS
 * does NOT list PM as a profitability consumer). Prefer the effective permission set;
 * fall back to the role map (ACCOUNTS_MANAGER ≡ ACCOUNTS_TEAM) when the projection is absent.
 */
function canViewProfitability(user: { role: string; permissions?: readonly { resource: string; action: string }[] | null }): boolean {
  if (user.permissions) return hasGrant(user as never, "cost_control.profitability", "READ");
  return user.role === "ADMIN" || roleMatches(["ACCOUNTS_TEAM"], user.role);
}

function toApiQuery(form: ProfitabilityFilterFormValues, page: number): ProfitabilityQuery {
  return {
    groupBy: form.groupBy,
    projectId: form.projectId || undefined,
    costCentreId: form.costCentreId || undefined,
    financialYearId: form.financialYearId || undefined,
    dateFrom: form.dateFrom || undefined,
    dateTo: form.dateTo || undefined,
    page,
  };
}

/**
 * Cost-centre profitability (FR-CC-009/010; spec). READ-ONLY revenue / cost / profit
 * grouped by cost centre and/or project — a query over the LED ledger (INCOME + EXPENSE),
 * with NO budget/status concept. Admin + Accounts Manager only (PM excluded, spec §11).
 * Loads at the default grouping on mount; the grouping control re-queries and persists
 * still-applicable filters. Profit is sortable (worst/best first). Full state matrix
 * (spec §6): forbidden (role) · loading · empty · partial · error+retry · offline.
 */
export function ProfitabilityScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canView = canViewProfitability(user);

  const [mode, setMode] = useState<ProfitGroupBy>("cost_centre");
  const [applied, setApplied] = useState<ProfitabilityFilterFormValues>(emptyProfitabilityFilter("cost_centre", ""));
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProfitSort>(null);

  const projectsQuery = useProjectOptions();
  const costCentresQuery = useCostCentreOptions();
  const fyQuery = useFinancialYearOptions();
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const costCentres = useMemo(() => costCentresQuery.data ?? [], [costCentresQuery.data]);
  const financialYears = useMemo(() => fyQuery.data ?? [], [fyQuery.data]);

  const query = useProfitability(toApiQuery(applied, page), canView && online);
  const rows = useMemo(() => {
    const raw = query.data?.data ?? [];
    if (!sort) return raw;
    const dir = sort === "asc" ? 1 : -1;
    return [...raw].sort((a, b) => (Number(a.profit) - Number(b.profit)) * dir);
  }, [query.data, sort]);

  const err = query.isError ? asApiError(query.error) : null;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const projectScopeError =
    forbidden && (applied.projectId || applied.costCentreId) ? "You don't have access to this project." : null;

  // Name resolution: an id not in the grouping renders "—"; an unresolved id → "(name unavailable)".
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const costCentreName = useMemo(() => new Map(costCentres.map((c) => [c.id, c])), [costCentres]);
  function costCentreLabelFor(row: ProfitabilityRow): CellLabel {
    if (!row.costCentreId) return { label: "—", unresolved: false, inactive: false };
    const c = costCentreName.get(row.costCentreId);
    if (!c) return { label: row.costCentreId, unresolved: true, inactive: false };
    return { label: `${c.code} — ${c.name}`, unresolved: false, inactive: !c.isActive };
  }
  function projectLabelFor(row: ProfitabilityRow): CellLabel {
    if (!row.projectId) return { label: "—", unresolved: false, inactive: false };
    const p = projectName.get(row.projectId);
    if (!p) return { label: row.projectId, unresolved: true, inactive: false };
    return { label: p.projectCode ? `${p.projectCode} — ${p.name}` : p.name, unresolved: false, inactive: false };
  }

  function changeMode(next: ProfitGroupBy) {
    if (next === mode) return;
    setMode(next);
    setPage(1);
    setApplied((a) => ({ ...a, groupBy: next }));
  }
  function apply(values: ProfitabilityFilterFormValues) {
    setPage(1);
    setApplied({ ...values, groupBy: mode });
  }
  function clear() {
    setPage(1);
    setSort(null);
    setApplied(emptyProfitabilityFilter(mode, ""));
  }
  function toggleSort() {
    setSort((s) => (s === null ? "asc" : s === "asc" ? "desc" : "asc"));
  }

  // Role gate — no data fetch for a viewer without profitability access (spec §11).
  if (!canView) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Cost Control" }, { label: "Cost-centre profitability" }]} />
        <div className="mt-8" data-testid="profit-forbidden">
          <EmptyState
            icon={Lock}
            title="You don't have access to profitability."
            description="Cost-centre profitability is available to Accounts Managers and Admins."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Cost Control" }, { label: "Cost-centre profitability" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="profit-title">
          Cost-centre profitability
        </h1>
        <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="text-[11.5px] font-semibold text-muted-foreground">Read-only</span>
        </span>
        <div className="ml-auto">
          <GroupingModeControl value={mode} disabled={query.isLoading} onChange={changeMode} />
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="profit-offline">
          Profitability figures may be out of date. Reconnect to refresh.
        </Alert>
      )}

      <ProfitabilityFilterBar
        groupBy={mode}
        defaults={applied}
        projects={projects}
        costCentres={costCentres}
        financialYears={financialYears}
        optionsLoading={projectsQuery.isLoading || costCentresQuery.isLoading}
        offline={!online}
        projectScopeError={projectScopeError}
        onApply={apply}
        onClear={clear}
      />

      <Card className="mt-4 flex flex-col overflow-hidden">
        <div className={cn("min-h-0 overflow-auto", query.isFetching && !query.isLoading && "opacity-60")}>
          {projectScopeError ? (
            <div className="p-8" data-testid="profit-scope-forbidden">
              <EmptyState
                icon={Lock}
                title="You don't have access to this project."
                description="Choose a project or cost centre within your access, or clear the filter."
              />
            </div>
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2 p-4" data-testid="profit-loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <Alert tone="destructive" title="Couldn't load profitability.">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="profit-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8" data-testid="profit-empty">
              <EmptyState
                icon={TrendingUp}
                title="No revenue or cost has been posted for this selection yet."
                description="Profitability appears once INCOME or EXPENSE entries are posted against a cost centre or project."
                action={
                  <Button size="md" variant="outline" onClick={clear} data-testid="profit-empty-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <ProfitabilityTable
              rows={rows}
              sort={sort}
              onToggleSort={toggleSort}
              costCentreLabelFor={costCentreLabelFor}
              projectLabelFor={projectLabelFor}
            />
          )}
        </div>

        {query.data && rows.length > 0 && !query.isError && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="profit-count">
              Showing <span className="font-semibold text-foreground">{rangeStart(query.data.page, query.data.pageSize, query.data.total)}</span>–
              <span className="font-semibold text-foreground">{rangeEnd(query.data.page, query.data.pageSize, query.data.total)}</span> of{" "}
              <span className="font-semibold text-foreground">{query.data.total}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={query.data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="profit-prev">
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={query.data.page * query.data.pageSize >= query.data.total}
                onClick={() => setPage((p) => p + 1)}
                data-testid="profit-next"
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
