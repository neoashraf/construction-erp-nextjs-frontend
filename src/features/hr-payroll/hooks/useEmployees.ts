"use client";

import { useMemo } from "react";
import {
  EMPLOYEES_SEED,
  ASSIGNMENTS_SEED,
} from "../seed/employees";
import {
  type Employee,
  type EmployeeAssignment,
  type EmployeeStatus,
  type WageType,
} from "../types";

/**
 * Employees data access (FR-HR-001/002/003). Backed by the local seed for now — the
 * filter/sort/paginate shape mirrors `GET /api/hr/employees` so these hooks can be
 * repointed at the live endpoint (React Query) without changing the screens. Reads
 * are synchronous against the seed, so no loading flash in the mockup.
 */

export interface EmployeeListFilter {
  status: EmployeeStatus | "ALL";
  defaultProjectId: string | "ALL";
  wageType: WageType | "ALL";
  q: string;
  page: number;
  pageSize: number;
}

export interface EmployeeListResult {
  data: Employee[];
  total: number;
  /** Count before pagination, after filters — drives the count pill. */
  filteredTotal: number;
}

/** Filtered, paginated employee list. Pure over the seed — memoised on the filter. */
export function useEmployeesList(filter: EmployeeListFilter): EmployeeListResult {
  return useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    const filtered = EMPLOYEES_SEED.filter((e) => {
      if (filter.status !== "ALL" && e.status !== filter.status) return false;
      if (filter.defaultProjectId !== "ALL" && e.defaultProjectId !== filter.defaultProjectId)
        return false;
      if (filter.wageType !== "ALL" && e.wageType !== filter.wageType) return false;
      if (q && !e.employeeCode.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q))
        return false;
      return true;
    });
    const start = (filter.page - 1) * filter.pageSize;
    return {
      data: filtered.slice(start, start + filter.pageSize),
      total: EMPLOYEES_SEED.length,
      filteredTotal: filtered.length,
    };
  }, [filter]);
}

/** A single employee by id (FR-HR-001). */
export function useEmployee(id: string): Employee | undefined {
  return useMemo(() => EMPLOYEES_SEED.find((e) => e.id === id || e.employeeCode === id), [id]);
}

/**
 * Append-only reassignment history (FR-HR-002), newest first. Employees without a
 * seeded trail get a synthesised single joining entry so the tab is never blank.
 */
export function useAssignments(employee: Employee | undefined): EmployeeAssignment[] {
  return useMemo(() => {
    if (!employee) return [];
    const seeded = ASSIGNMENTS_SEED[employee.id];
    if (seeded) return seeded;
    return [
      {
        id: `${employee.id}-join`,
        employeeId: employee.id,
        projectName: employee.defaultProjectId
          ? employee.defaultProjectId.replace(/^FAIL:/, "")
          : "Head Office",
        effectiveDate: employee.joiningDate,
        note: "Initial assignment on joining.",
        isCurrent: true,
        isJoining: true,
      },
    ];
  }, [employee]);
}

/** Count of active employees — for the "N active" count pill. */
export function useActiveEmployeeCount(): number {
  return useMemo(() => EMPLOYEES_SEED.filter((e) => e.status === "ACTIVE").length, []);
}
