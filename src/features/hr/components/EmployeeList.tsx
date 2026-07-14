"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useOnline } from "@/lib/hooks/use-online";
import { useMasterLookups } from "@/lib/masters/lookups";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteEmployee } from "../access";
import { useEmployees } from "../hooks/useEmployees";
import { EMPTY_EMPLOYEE_FILTER, EmployeeFilterBar, type EmployeeFilter } from "./EmployeeFilterBar";
import { EmployeeStatusBadge } from "./StatusBadge";
import { EmployeeCreateDrawer } from "./EmployeeCreateDrawer";
import { WAGE_TYPE_LABEL, WORK_BASE_LABEL } from "../schemas/employee.schema";
import { type EmployeeSummary } from "../types";
import { type EmployeeListFilter as ApiFilter } from "../api/employees";

function toApi(f: EmployeeFilter, page: number): ApiFilter {
  return {
    status: f.status || undefined,
    defaultProjectId: f.defaultProjectId || undefined,
    wageType: f.wageType || undefined,
    q: f.q || undefined,
    page,
  };
}

function isFiltered(f: EmployeeFilter): boolean {
  return !!f.status || !!f.defaultProjectId || !!f.wageType || !!f.q;
}

const GRID = "minmax(96px,1fr) minmax(140px,1.4fr) minmax(120px,1.1fr) minmax(120px,1.1fr) 100px 96px 110px 100px 44px";
const MONEY = "whitespace-nowrap font-mono text-[12.5px] tabular-nums";

function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

/**
 * Employee list screen (spec §4/§6). Filterable, paginated master. Read for HR / Accounts /
 * Admin (company-wide); Site Engineer / Store Keeper / PM: nav hidden + 403 on direct URL
 * (server-enforced; the module guard also redirects). "New employee" CTA is HIDDEN for read-
 * only actors (Accounts). Full state matrix: loading skeletons · error+retry · two empties
 * (filtered vs first-use) · offline banner · default. Rows deep-link to `/hr/employees/{id}`.
 */
export function EmployeeList() {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canCreate = canWriteEmployee(user);
  const lookups = useMasterLookups();
  const [applied, setApplied] = useState<EmployeeFilter>(EMPTY_EMPLOYEE_FILTER);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const query = useEmployees(toApi(applied, page));
  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const total = query.data?.total ?? 0;

  // Reuse the shared master lookups so we surface the actual project names in the filter dropdown.
  // The lookups helper degrades silently (empty list) when the masters call fails; the row's
  // "Default project" column falls back to the id when a project name can't be resolved.
  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const pid = r.defaultProjectId;
      if (pid && !seen.has(pid)) seen.set(pid, lookups.project(pid));
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows, lookups]);

  function apply(f: EmployeeFilter) {
    setPage(1);
    setApplied(f);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_EMPLOYEE_FILTER);
  }

  function onCreated(id: string) {
    setDrawerOpen(false);
    router.push(`/hr/employees/${id}`);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "HR" }, { label: "Employees" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="employee-list-title">
          Employees
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} employee{total === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canCreate && (
          <Button
            size="md"
            className="ml-auto gap-1.5"
            onClick={() => setDrawerOpen(true)}
            data-testid="employee-new"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New employee
          </Button>
        )}
      </div>

      {!online && (
        <Alert tone="warning" className="mb-3" title="You're offline. Showing the last loaded employees.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Filters and saves are paused until you reconnect.
          </span>
        </Alert>
      )}

      <EmployeeFilterBar applied={applied} projects={projectOptions} onApply={apply} onClear={clear} />

      <Card
        className={cn(
          "mt-1 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="employee-loading">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load employees. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="employee-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          isFiltered(applied) ? (
            <div className="p-8" data-testid="employee-empty-filtered">
              <EmptyState
                icon={Users}
                title="No employees match these filters."
                description="Try a wider status or a different project."
                action={
                  <Button size="md" variant="outline" onClick={clear} data-testid="employee-empty-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8" data-testid="employee-empty-firstuse">
              <EmptyState
                icon={Users}
                title="No employees yet."
                description="Add your first office-staff employee to start tracking attendance and payroll."
                action={
                  canCreate ? (
                    <Button size="md" onClick={() => setDrawerOpen(true)} data-testid="employee-empty-new">
                      New employee
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <EmployeeTable rows={rows} projectName={lookups.project} />
        )}

        {query.data && rows.length > 0 && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground" data-testid="employee-count">
              Showing <span className="font-semibold text-foreground">{(page - 1) * query.data.pageSize + 1}</span>–
              <span className="font-semibold text-foreground">{Math.min(page * query.data.pageSize, total)}</span> of{" "}
              <span className="font-semibold text-foreground">{total}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="employee-prev"
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page * query.data.pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                data-testid="employee-next"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {canCreate && (
        <EmployeeCreateDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onCreated={onCreated}
        />
      )}
    </div>
  );
}

/**
 * The employee table — desktop grid ≥lg, stacked read-only cards below lg (the design
 * file's degraded mobile/tablet frame). Row-level actions (View / Reassign / Deactivate)
 * are handled on the detail page — this list keeps the row lean, which mirrors the design.
 */
function EmployeeTable({
  rows,
  projectName,
}: {
  rows: EmployeeSummary[];
  projectName: (id: string | null | undefined) => string;
}) {
  const proj = (id: string | null) => {
    if (!id) return "— Unassigned —";
    const name = projectName(id);
    // `lookups.project` degrades to the raw id when the master fetch fails (spec §6 partial).
    if (name === id) return `${id.slice(0, 8)} (project name unavailable)`;
    return name;
  };

  return (
    <div data-testid="employee-list">
      {/* ≥lg full grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 960 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">Code</div>
            <div className="py-3">Name</div>
            <div className="py-3">Designation</div>
            <div className="py-3">Default project</div>
            <div className="py-3">Work base</div>
            <div className="py-3">Wage type</div>
            <div className="py-3 text-right">Wage ৳</div>
            <div className="py-3">Status</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/hr/employees/${r.id}`}
              role="row"
              data-testid={`employee-row-${r.status}`}
              className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="min-w-0 py-3 font-mono text-[12.5px] font-semibold text-accent-ink">
                {r.employeeCode}
              </div>
              <div className="min-w-0 py-3 text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">
                {r.name}
              </div>
              <div className="min-w-0 py-3 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
                {r.designation ?? ""}
              </div>
              <div className="min-w-0 py-3 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
                {proj(r.defaultProjectId)}
              </div>
              <div className="min-w-0 py-3 text-[12px] text-muted-foreground">{WORK_BASE_LABEL[r.workBase]}</div>
              <div className="min-w-0 py-3 text-[12px] text-muted-foreground">{WAGE_TYPE_LABEL[r.wageType]}</div>
              <div className="py-3 text-right">
                <span className={MONEY}>{money(r.wageAmount)}</span>
              </div>
              <div className="py-3">
                <EmployeeStatusBadge status={r.status} />
              </div>
              <div className="py-3 text-right text-[11px] text-muted-foreground" aria-hidden>
                ›
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* <lg degraded read-only cards (design file "mobile 390" frame). No create/edit here. */}
      <div className="flex flex-col lg:hidden" data-testid="employee-list-mobile">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/hr/employees/${r.id}`}
            data-testid={`employee-card-${r.status}`}
            className="border-b border-muted px-4 py-3 hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-[12px] font-semibold text-accent-ink">{r.employeeCode}</span>
              <EmployeeStatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">{r.name}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
              {r.designation ?? "—"} · {proj(r.defaultProjectId)}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12px]">
              <LabelVal label="Work base" value={WORK_BASE_LABEL[r.workBase]} />
              <LabelVal label={WAGE_TYPE_LABEL[r.wageType]} value={`৳ ${money(r.wageAmount)}`} />
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
