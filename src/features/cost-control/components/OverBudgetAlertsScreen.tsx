"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { useOverBudgetAlerts } from "../hooks/useOverBudgetAlerts";
import { useOnline } from "../hooks/useOnline";
import { useCostCentreOptions, useProjectOptions } from "../hooks/useCostControlOptions";
import { AlertsTable, type CellLabel } from "./AlertsTable";
import { StatusChipFilter } from "./StatusChipFilter";
import { LastRefreshedIndicator } from "./LastRefreshedIndicator";
import { ALERT_STATUSES, alertStatusToApi, type AlertStatus } from "../schemas/alerts.schema";
import { type BudgetVsActualRow } from "../types";

/** Severity rank so OVER always sorts before APPROACHING (spec §5). */
const SEVERITY: Record<string, number> = { OVER: 0, APPROACHING: 1 };

function sortBySeverity(rows: BudgetVsActualRow[]): BudgetVsActualRow[] {
  return [...rows].sort((a, b) => {
    const s = (SEVERITY[a.status] ?? 9) - (SEVERITY[b.status] ?? 9);
    if (s !== 0) return s;
    return Number(b.utilisationPct ?? 0) - Number(a.utilisationPct ?? 0);
  });
}

/**
 * Over-budget alerts (FR-CC-011/012/015/016; spec). The current, LIVE list of
 * `(project, cost centre)` pairs classified OVER or APPROACHING — never a stored,
 * dismissible record (no acknowledge/snooze anywhere). Pull-based: loads on mount and on
 * manual Refresh (no auto-poll). Status chips + an Accounts/Admin project filter narrow
 * the query; rows sort most-severe first. Full state matrix (spec §6): default · loading ·
 * two distinct empty variants (good-news vs filtered) · partial · error+retry · offline ·
 * PM project-scope 403. No mutating action — CC never writes.
 */
export function OverBudgetAlertsScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  // PM is always server-scoped to assigned projects → no project-filter control (spec §5).
  const showProjectFilter = user.role !== "PROJECT_MANAGER";

  const [status, setStatus] = useState<AlertStatus[]>([...ALERT_STATUSES]);
  const [projectId, setProjectId] = useState("");
  const [page, setPage] = useState(1);

  const projectsQuery = useProjectOptions();
  const costCentresQuery = useCostCentreOptions();
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const costCentres = useMemo(() => costCentresQuery.data ?? [], [costCentresQuery.data]);

  const query = useOverBudgetAlerts(
    { status: alertStatusToApi(status), projectId: projectId || undefined, page },
    online,
  );
  const rows = useMemo(() => sortBySeverity(query.data?.data ?? []), [query.data]);
  const lastRefreshed = query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null;

  const err = query.isError ? asApiError(query.error) : null;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const projectScopeError = forbidden && projectId ? "You don't have access to this project." : null;

  // Name resolution → id + "(name unavailable)" when a name can't resolve (spec §6 partial).
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const costCentreName = useMemo(() => new Map(costCentres.map((c) => [c.id, c])), [costCentres]);
  function projectLabelFor(row: BudgetVsActualRow): CellLabel {
    const p = projectName.get(row.projectId);
    if (!p) return { label: row.projectId, unresolved: true, inactive: false };
    return { label: p.projectCode ? `${p.projectCode} — ${p.name}` : p.name, unresolved: false, inactive: false };
  }
  function costCentreLabelFor(row: BudgetVsActualRow): CellLabel {
    const c = costCentreName.get(row.costCentreId);
    if (!c) return { label: row.costCentreId, unresolved: true, inactive: false };
    return { label: `${c.code} — ${c.name}`, unresolved: false, inactive: !c.isActive };
  }

  function changeStatus(next: AlertStatus[]) {
    setPage(1);
    setStatus(next);
  }
  function changeProject(id: string) {
    setPage(1);
    setProjectId(id);
  }
  function clearFilters() {
    setPage(1);
    setStatus([...ALERT_STATUSES]);
    setProjectId("");
  }

  const filtered = status.length < ALERT_STATUSES.length || !!projectId;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Cost Control" }, { label: "Over-budget alerts" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="alerts-title">
          Over-budget alerts
        </h1>
        <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="text-[11.5px] font-semibold text-muted-foreground">Read-only feed</span>
        </span>
        <div className="ml-auto">
          <LastRefreshedIndicator
            lastRefreshed={lastRefreshed}
            refreshing={query.isFetching}
            disabled={!online}
            onRefresh={() => query.refetch()}
          />
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="alerts-offline">
          Alerts may be out of date. This is a live feed — reconnect to see the current picture.
        </Alert>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <Label id="alerts-status-label">Status</Label>
            <StatusChipFilter value={status} onChange={changeStatus} />
          </div>
          {showProjectFilter && (
            <div className="flex min-w-[220px] flex-col gap-1.5">
              <Label htmlFor="alerts-project">Project</Label>
              <Select
                id="alerts-project"
                data-testid="alerts-project"
                disabled={projectsQuery.isLoading}
                value={projectId}
                onChange={(e) => changeProject(e.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="ml-auto flex items-end">
            <Button type="button" variant="ghost" size="md" onClick={clearFilters} data-testid="alerts-clear">
              Clear filters
            </Button>
          </div>
        </div>
        {projectScopeError && (
          <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="alerts-project-scope-error">
            {projectScopeError}
          </p>
        )}
      </Card>

      {/* Screen-reader severity-order description (spec §10). */}
      <p className="sr-only" data-testid="alerts-sort-note">
        Alerts are sorted most severe first — over budget before approaching.
      </p>

      <Card className="mt-4 flex flex-col overflow-hidden">
        <div className={cn("min-h-0 overflow-auto", query.isFetching && !query.isLoading && "opacity-60")}>
          {projectScopeError ? (
            <div className="p-8" data-testid="alerts-forbidden">
              <EmptyState
                icon={SearchX}
                title="You don't have access to this project."
                description="Project managers can only see alerts for their assigned projects."
              />
            </div>
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2 p-4" data-testid="alerts-loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <Alert tone="destructive" title="Couldn't load over-budget alerts.">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="alerts-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            </div>
          ) : rows.length === 0 ? (
            filtered ? (
              <div className="p-8" data-testid="alerts-empty-filtered">
                <EmptyState
                  icon={SearchX}
                  title="No alerts match this filter."
                  description="Try turning a status chip back on or clearing the project filter."
                  action={
                    <Button size="md" variant="outline" onClick={clearFilters} data-testid="alerts-empty-clear">
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="p-6" data-testid="alerts-empty-none">
                <div className="flex flex-col items-center justify-center rounded-card border border-success-soft bg-success-soft px-6 py-12 text-center">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-success text-success-foreground">
                    <CheckCircle2 className="h-6 w-6" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-success-ink">
                    Nothing to flag — no cost centres are over or approaching budget right now.
                  </p>
                  <p className="mt-1 max-w-md text-xs text-success-ink/80">
                    Alerts appear here the moment a project&apos;s spend crosses 90% of its budget. Last checked{" "}
                    {lastRefreshed ? "just now" : "—"}.
                  </p>
                </div>
              </div>
            )
          ) : (
            <AlertsTable rows={rows} projectLabelFor={projectLabelFor} costCentreLabelFor={costCentreLabelFor} />
          )}
        </div>

        {query.data && rows.length > 0 && !query.isError && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="alerts-count">
              Showing <span className="font-semibold text-foreground">{rangeStart(query.data.page, query.data.pageSize, query.data.total)}</span>–
              <span className="font-semibold text-foreground">{rangeEnd(query.data.page, query.data.pageSize, query.data.total)}</span> of{" "}
              <span className="font-semibold text-foreground">{query.data.total}</span> alert{query.data.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={query.data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="alerts-prev">
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={query.data.page * query.data.pageSize >= query.data.total}
                onClick={() => setPage((p) => p + 1)}
                data-testid="alerts-next"
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
