"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import { useEmployee, useAssignments } from "../hooks/useEmployees";
import { type Employee } from "../types";
import { projectResolves, projectText } from "../lib";
import { EmployeeStatusBadge } from "./EmployeeBadges";
import { EmployeeProfileForm } from "./EmployeeProfileForm";
import { AssignmentHistory } from "./AssignmentHistory";
import { EmployeeFormSheet } from "./EmployeeFormSheet";
import { ReassignDialog, StatusDialog } from "./EmployeeDialogs";

const LIST_PATH = "/hr/employees";
const isBn = (s: string) => /[ঀ-৿]/.test(s);

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/**
 * Employee detail (FR-HR-001/002/003; Employees.dc.html detail). Header carries
 * name + status + meta and (for managers) Reassign / Deactivate. Two tabs: Profile
 * (identity & wage · bank & statutory) and the append-only Assignment history. Manage
 * is permission-driven (`hr.employees:UPDATE`); other roles get a read-only profile.
 */
export function EmployeeDetailScreen({ id }: { id: string }) {
  const session = useSession();
  const canManage = session ? hasGrant(session, "hr.employees", "UPDATE") : false;

  const employee = useEmployee(id);
  const assignments = useAssignments(employee);

  const [tab, setTab] = useState<"profile" | "history">("profile");
  const [editing, setEditing] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [statusMode, setStatusMode] = useState<"deactivate" | "reactivate" | null>(null);

  const backLink = (
    <Link
      href={LIST_PATH}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Employees
    </Link>
  );

  if (!employee) {
    return (
      <div className="mx-auto max-w-4xl">
        {backLink}
        <div className="mt-4">
          <EmptyState
            title="Employee not found."
            description="This employee may have been removed, or the link is out of date."
            action={
              <Button asChild variant="outline">
                <Link href={LIST_PATH}>Back to employees</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb
        items={[
          { label: "Employees", href: LIST_PATH },
          { label: employee.employeeCode },
        ]}
      />

      {/* header block */}
      <div className="flex flex-wrap items-start gap-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn(
                "text-[23px] font-bold tracking-[-0.01em]",
                isBn(employee.name) && "font-sans",
              )}
            >
              {employee.name}
            </h1>
            <EmployeeStatusBadge status={employee.status} />
          </div>
          <MetaLine employee={employee} />
        </div>
        {canManage && (
          <div className="ml-auto flex flex-none gap-2.5">
            <Button variant="outline" size="md" onClick={() => setReassignOpen(true)}>
              Reassign
            </Button>
            {employee.status === "ACTIVE" ? (
              <Button
                variant="outline"
                size="md"
                className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
                onClick={() => setStatusMode("deactivate")}
                data-testid="deactivate-employee"
              >
                Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="md"
                onClick={() => setStatusMode("reactivate")}
                data-testid="reactivate-employee"
              >
                Reactivate
              </Button>
            )}
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="mt-4 flex items-end gap-6 border-b border-border-strong">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
          Profile
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")} count={assignments.length}>
          Assignment history
        </TabButton>
      </div>

      {tab === "profile" ? (
        <div className="mt-4">
          <EmployeeProfileForm employee={employee} canManage={canManage} />
          <div className="mt-4">
            <Alert tone="info">
              Only named office staff belong here. Subcontractor and daily-labour workers are tracked
              as head counts on the Attendance screen.
            </Alert>
          </div>
          {canManage && (
            <div className="mt-4 flex justify-end gap-2.5">
              <Button variant="ghost" size="md" asChild>
                <Link href={LIST_PATH}>Cancel</Link>
              </Button>
              <Button size="md" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <AssignmentHistory assignments={assignments} />
        </div>
      )}

      {/* Edit reuses the create drawer, pre-filled */}
      {editing && (
        <EmployeeFormSheet
          mode={{ kind: "edit", employee }}
          onClose={() => setEditing(false)}
        />
      )}
      <ReassignDialog
        employee={reassignOpen ? employee : null}
        onClose={() => setReassignOpen(false)}
      />
      <StatusDialog
        employee={statusMode ? employee : null}
        mode={statusMode ?? "deactivate"}
        onClose={() => setStatusMode(null)}
      />
    </div>
  );
}

function MetaLine({ employee }: { employee: Employee }) {
  const base = employee.workBase === "SITE" ? "Site" : "Head office";
  return (
    <div className="mt-1.5 text-[12.5px] text-muted-foreground">
      {employee.designation} · {base} · Default project{" "}
      <span
        className={cn(
          "font-medium",
          projectResolves(employee.defaultProjectId) ? "text-foreground" : "text-faint",
        )}
      >
        {projectText(employee.defaultProjectId)}
      </span>{" "}
      · Joined{" "}
      <span className="font-mono tabular-nums">{safeDate(employee.joiningDate)}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-2 border-b-2 pb-2.5 text-[13.5px] transition-colors",
        active
          ? "border-accent font-semibold text-foreground"
          : "border-transparent font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {count != null && (
        <span className="inline-flex h-[18px] items-center rounded-pill bg-muted px-1.5 text-[10.5px] font-semibold text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}
