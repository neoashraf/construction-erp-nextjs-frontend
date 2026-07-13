"use client";

import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PROJECT_OPTIONS } from "../seed/employees";
import { type EmployeeStatus, type WageType } from "../types";

export type StatusFilter = EmployeeStatus | "ALL";
export type ProjectFilter = string | "ALL";
export type WageFilter = WageType | "ALL";

/** Uppercase micro-label above a filter control (per Employees.dc.html). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Employees list filter bar (Employees.dc.html). One horizontal row: Status ·
 * Default project · Wage type selects, a labelled code/name search, and Apply /
 * Clear. `q` is a draft applied on Apply / Enter (mirrors the Parties bar).
 */
export function EmployeeFilterBar({
  status,
  onStatus,
  project,
  onProject,
  wage,
  onWage,
  q,
  onQ,
  onApply,
  onClear,
}: {
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  project: ProjectFilter;
  onProject: (v: ProjectFilter) => void;
  wage: WageFilter;
  onWage: (v: WageFilter) => void;
  q: string;
  onQ: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="p-3.5 sm:px-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Status */}
        <div className="flex flex-none flex-col gap-1.5">
          <FieldLabel>Status</FieldLabel>
          <Select
            aria-label="Filter by status"
            title="Inactive staff are excluded from new attendance and salary cycles"
            value={status}
            onChange={(e) => onStatus(e.target.value as StatusFilter)}
            className="h-9 w-[150px]"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All statuses</option>
          </Select>
        </div>

        {/* Default project */}
        <div className="flex flex-none flex-col gap-1.5">
          <FieldLabel>Default project</FieldLabel>
          <Select
            aria-label="Filter by default project"
            value={project}
            onChange={(e) => onProject(e.target.value as ProjectFilter)}
            className="h-9 w-[200px]"
          >
            <option value="ALL">All projects</option>
            {PROJECT_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Wage type */}
        <div className="flex flex-none flex-col gap-1.5">
          <FieldLabel>Wage type</FieldLabel>
          <Select
            aria-label="Filter by wage type"
            value={wage}
            onChange={(e) => onWage(e.target.value as WageFilter)}
            className="h-9 w-[150px]"
          >
            <option value="ALL">All wage types</option>
            <option value="MONTHLY">Monthly</option>
            <option value="DAILY">Daily</option>
          </Select>
        </div>

        {/* Search */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel>Search</FieldLabel>
          <div className="flex h-9 min-w-0 items-center gap-2 rounded-token border border-border-strong bg-surface px-3 transition-colors focus-within:border-accent focus-within:shadow-focus">
            <Search className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => onQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onApply();
              }}
              placeholder="Search by code or name"
              aria-label="Search employees by code or name"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-faint"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-none items-end gap-2">
          <Button size="sm" className="h-9 px-4" onClick={onApply}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" className="h-9 px-2.5" onClick={onClear}>
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  );
}
