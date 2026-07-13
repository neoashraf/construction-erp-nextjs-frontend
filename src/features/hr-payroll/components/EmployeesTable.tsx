"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type Employee } from "../types";
import {
  displayMoneyBare,
  projectResolves,
  projectText,
  wageAmountSubLabel,
} from "../lib";
import { EmployeeStatusBadge, WageTypePill, WorkBaseChip } from "./EmployeeBadges";

type SortKey = "code" | "name" | "wage";
type SortDir = "asc" | "desc";

const isBn = (s: string) => /[ঀ-৿]/.test(s);

/** The employee code cell — always links to the detail page (per Employees.dc.html). */
function CodeLink({ employee }: { employee: Employee }) {
  return (
    <Link
      href={`/hr/employees/${employee.id}`}
      className="font-mono text-[12.5px] font-semibold text-accent-ink hover:underline"
    >
      {employee.employeeCode}
    </Link>
  );
}

/** Clickable sortable column header (mirrors PartiesTable). Toggles asc→desc. */
function SortableHead({
  label,
  columnKey,
  sort,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  columnKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sort.key === columnKey;
  const asc = active && sort.dir === "asc";
  const desc = active && sort.dir === "desc";
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("p-0", className)}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          "flex h-10 w-full select-none items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground",
          align === "right" ? "justify-end text-right" : "text-left",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
          <span className={asc ? "text-foreground" : "text-border-strong"}>▲</span>
          <span className={desc ? "text-foreground" : "text-border-strong"}>▼</span>
        </span>
      </button>
    </TableHead>
  );
}

function RowActions({
  employee,
  canManage,
  onReassign,
  onDeactivate,
  onReactivate,
}: {
  employee: Employee;
  canManage: boolean;
  onReassign: (e: Employee) => void;
  onDeactivate: (e: Employee) => void;
  onReactivate: (e: Employee) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${employee.name}`}
        data-testid={`employee-actions-${employee.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-faint transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/hr/employees/${employee.id}`}>View</Link>
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuItem onSelect={() => onReassign(employee)}>Reassign</DropdownMenuItem>
            {employee.status === "ACTIVE" ? (
              <DropdownMenuItem
                className="text-destructive-ink"
                onSelect={() => onDeactivate(employee)}
              >
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onReactivate(employee)}>
                Reactivate
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Employees list table (Employees.dc.html §list). Desktop = dense 8-column table
 * (code · name+work-base · designation · default project · wage type · wage amount ·
 * status · kebab); ≤767px stacks as cards. Inactive rows are dimmed. Client-side sort
 * within the page on Code / Name / Wage amount.
 */
export function EmployeesTable({
  employees,
  canManage,
  onReassign,
  onDeactivate,
  onReactivate,
}: {
  employees: Employee[];
  canManage: boolean;
  onReassign: (e: Employee) => void;
  onDeactivate: (e: Employee) => void;
  onReactivate: (e: Employee) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "code", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const sorted = useMemo(() => {
    const arr = employees.slice();
    arr.sort((a, b) => {
      let cmp: number;
      if (sort.key === "code") cmp = a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true });
      else if (sort.key === "name")
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      else cmp = Number(a.wageAmount) - Number(b.wageAmount);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [employees, sort]);

  return (
    <div>
      {/* Desktop / tablet (≥768px) */}
      <div className="hidden md:block" data-testid="employees-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead label="Code" columnKey="code" sort={sort} onSort={toggleSort} className="w-[120px]" />
              <SortableHead label="Name" columnKey="name" sort={sort} onSort={toggleSort} />
              <TableHead className="hidden lg:table-cell">Designation</TableHead>
              <TableHead>Default project</TableHead>
              <TableHead className="hidden xl:table-cell">Wage type</TableHead>
              <SortableHead label="Wage amount ৳" columnKey="wage" sort={sort} onSort={toggleSort} align="right" className="text-right" />
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((e) => (
              <TableRow
                key={e.id}
                data-testid={`employee-row-${e.id}`}
                className={cn(e.status === "INACTIVE" && "opacity-60")}
              >
                <TableCell className="align-top">
                  <CodeLink employee={e} />
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-1">
                    <span
                      className={cn(
                        "text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]",
                        isBn(e.name) && "font-sans",
                      )}
                    >
                      {e.name}
                    </span>
                    <span>
                      <WorkBaseChip workBase={e.workBase} />
                    </span>
                    {/* designation folds under the name below lg */}
                    <span className="text-[11.5px] text-muted-foreground lg:hidden">
                      {e.designation}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden align-top text-[13px] text-foreground [overflow-wrap:anywhere] lg:table-cell">
                  {e.designation}
                </TableCell>
                <TableCell className="align-top">
                  <span
                    className={cn(
                      "text-[13px] [overflow-wrap:anywhere]",
                      e.defaultProjectId == null || !projectResolves(e.defaultProjectId)
                        ? "text-faint"
                        : "text-foreground",
                    )}
                  >
                    {projectText(e.defaultProjectId)}
                  </span>
                  {e.defaultProjectId != null && !projectResolves(e.defaultProjectId) && (
                    <div className="text-[11px] text-faint">(project name unavailable)</div>
                  )}
                </TableCell>
                <TableCell className="hidden align-top xl:table-cell">
                  <WageTypePill wageType={e.wageType} />
                </TableCell>
                <TableCell className="align-top text-right">
                  <div className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                    {displayMoneyBare(e.wageAmount)}
                  </div>
                  <div className="text-[10.5px] text-faint">{wageAmountSubLabel(e.wageType)}</div>
                </TableCell>
                <TableCell className="align-top">
                  <EmployeeStatusBadge status={e.status} />
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-center">
                    <RowActions
                      employee={e}
                      canManage={canManage}
                      onReassign={onReassign}
                      onDeactivate={onDeactivate}
                      onReactivate={onReactivate}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards (≤767px) — read-only per the design */}
      <ul className="flex flex-col gap-2.5 md:hidden" data-testid="employees-cards">
        {sorted.map((e) => (
          <li
            key={e.id}
            className="rounded-card border border-border bg-surface p-3.5"
            data-testid={`employee-card-${e.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/hr/employees/${e.id}`}
                  className={cn(
                    "text-[14.5px] font-semibold text-foreground hover:underline [overflow-wrap:anywhere]",
                    isBn(e.name) && "font-sans",
                  )}
                >
                  {e.name}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                  <span className="font-mono font-semibold text-accent-ink">{e.employeeCode}</span>
                  <span className="text-border-strong">·</span>
                  <span className="truncate text-muted-foreground">{e.designation}</span>
                </div>
              </div>
              <EmployeeStatusBadge status={e.status} />
            </div>
            <div className="mt-3 flex flex-col gap-1.5 border-t border-canvas pt-2.5">
              <Row label="Default project">
                <span
                  className={cn(
                    "text-right text-[12px] font-medium [overflow-wrap:anywhere]",
                    projectResolves(e.defaultProjectId) ? "text-foreground" : "text-faint",
                  )}
                >
                  {projectText(e.defaultProjectId)}
                </span>
              </Row>
              <Row label={`Wage · ${wageAmountSubLabel(e.wageType)}`}>
                <span className="font-mono text-[12.5px] font-semibold tabular-nums text-foreground">
                  ৳ {displayMoneyBare(e.wageAmount)}
                </span>
              </Row>
              <Row label="Work base">
                <WorkBaseChip workBase={e.workBase} />
              </Row>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-[11px] text-faint">{label}</span>
      {children}
    </div>
  );
}
