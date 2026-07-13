"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Search, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useEmployeesList, useActiveEmployeeCount } from "../hooks/useEmployees";
import { type Employee } from "../types";
import {
  EmployeeFilterBar,
  type StatusFilter,
  type ProjectFilter,
  type WageFilter,
} from "./EmployeeFilterBar";
import { EmployeesTable } from "./EmployeesTable";
import { EmployeeFormSheet } from "./EmployeeFormSheet";
import { ReassignDialog, StatusDialog } from "./EmployeeDialogs";

const PAGE_SIZE = 10;

type FormTarget = { kind: "create" } | { kind: "edit"; employee: Employee };

/**
 * Employees master — list screen (FR-HR-001/002/003; Employees.dc.html). Named
 * office staff only. Filters by status / default project / wage type + a code/name
 * search; the table hosts view/reassign/deactivate actions. Create + manage are
 * permission-driven (`hr.employees:UPDATE`); other roles get read-only. Backed by the
 * local seed for now (see `hooks/useEmployees`).
 */
export function EmployeesScreen() {
  const session = useSession();
  const canManage = session ? hasGrant(session, "hr.employees", "UPDATE") : false;

  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [project, setProject] = useState<ProjectFilter>("ALL");
  const [wage, setWage] = useState<WageFilter>("ALL");
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Employee | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    employee: Employee;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  useEffect(() => setPage(1), [status, project, wage, q]);

  const filter = useMemo(
    () => ({ status, defaultProjectId: project, wageType: wage, q, page, pageSize: PAGE_SIZE }),
    [status, project, wage, q, page],
  );
  const result = useEmployeesList(filter);
  const activeCount = useActiveEmployeeCount();

  const hasFilters = status !== "ACTIVE" || project !== "ALL" || wage !== "ALL" || q !== "";
  const rows = result.data;
  const total = result.filteredTotal;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  function applyFilters() {
    setQ(qDraft.trim());
  }
  function clearFilters() {
    setStatus("ACTIVE");
    setProject("ALL");
    setWage("ALL");
    setQDraft("");
    setQ("");
  }

  const countPill = status === "ACTIVE" ? `${activeCount} active` : `${total} shown`;

  return (
    <div className="mx-auto max-w-6xl">
      {/* title row: H1 + count pill + create (content header owns page actions) */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">Employees</h1>
        <span className="inline-flex h-[23px] items-center whitespace-nowrap rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
          {countPill}
        </span>
        {canManage && (
          <Button
            className="ml-auto h-[38px] flex-none px-4"
            onClick={() => setFormTarget({ kind: "create" })}
            data-testid="new-employee"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New employee
          </Button>
        )}
      </div>

      {/* mobile read-only note (matches the mobile frame in the design) */}
      <div className="mt-4 md:hidden">
        <Alert tone="warning">
          Read-only on mobile. Create, edit, reassign and deactivate need a desktop or tablet — this
          master isn’t an attendance-capture screen.
        </Alert>
      </div>

      <div className="mt-4 hidden md:block">
        <EmployeeFilterBar
          status={status}
          onStatus={setStatus}
          project={project}
          onProject={setProject}
          wage={wage}
          onWage={setWage}
          q={qDraft}
          onQ={setQDraft}
          onApply={applyFilters}
          onClear={clearFilters}
        />
      </div>

      <Card className="mt-4 overflow-hidden p-3 sm:p-4">
        {rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No employees match these filters."
              description="Try a different status, project, wage type, or search term."
              action={
                <Button variant="outline" onClick={clearFilters} data-testid="clear-filters">
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No employees yet."
              description="Add your first office-staff employee to start tracking attendance and payroll."
              action={
                canManage ? (
                  <Button onClick={() => setFormTarget({ kind: "create" })}>
                    <Plus className="h-4 w-4" aria-hidden />
                    New employee
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <EmployeesTable
              employees={rows}
              canManage={canManage}
              onReassign={(e) => setReassignTarget(e)}
              onDeactivate={(e) => setStatusTarget({ employee: e, mode: "deactivate" })}
              onReactivate={(e) => setStatusTarget({ employee: e, mode: "reactivate" })}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {rangeFrom}–{rangeTo}
                </span>{" "}
                of <span className="font-semibold text-foreground">{total}</span> employee
                {total === 1 ? "" : "s"}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="text-[12.5px] tabular-nums text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {formTarget && (
        <EmployeeFormSheet mode={formTarget} onClose={() => setFormTarget(null)} />
      )}
      <ReassignDialog employee={reassignTarget} onClose={() => setReassignTarget(null)} />
      <StatusDialog
        employee={statusTarget?.employee ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
      />
    </div>
  );
}
