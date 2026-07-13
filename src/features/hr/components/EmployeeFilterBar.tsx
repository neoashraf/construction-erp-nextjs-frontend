"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

/**
 * Employee list filter bar (spec §4). Status / project / wage-type / code-or-name typeahead.
 * Applied on `Apply`; `Clear filters` resets. Consistent with the other master list bars.
 */
export interface EmployeeFilter {
  status: string; // "", ACTIVE, INACTIVE
  defaultProjectId: string;
  wageType: string; // "", MONTHLY, DAILY
  q: string;
}

export const EMPTY_EMPLOYEE_FILTER: EmployeeFilter = {
  status: "",
  defaultProjectId: "",
  wageType: "",
  q: "",
};

interface ProjectOption {
  id: string;
  name: string;
}

export function EmployeeFilterBar({
  applied,
  projects,
  onApply,
  onClear,
}: {
  applied: EmployeeFilter;
  projects: ProjectOption[];
  onApply: (f: EmployeeFilter) => void;
  onClear: () => void;
}) {
  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-2 rounded-card border border-border bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onApply({
          status: String(fd.get("status") ?? ""),
          defaultProjectId: String(fd.get("defaultProjectId") ?? ""),
          wageType: String(fd.get("wageType") ?? ""),
          q: String(fd.get("q") ?? ""),
        });
      }}
      role="search"
      aria-label="Filter employees"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="emp-filter-q" className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Code or name
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="emp-filter-q" name="q" defaultValue={applied.q} placeholder="EMP-014 or Rafiqul" className="h-9 w-[220px] pl-8" data-testid="emp-filter-q" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="emp-filter-status" className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Status
        </label>
        <Select id="emp-filter-status" name="status" defaultValue={applied.status} className="w-[140px]" data-testid="emp-filter-status">
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="emp-filter-project" className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Default project
        </label>
        <Select id="emp-filter-project" name="defaultProjectId" defaultValue={applied.defaultProjectId} className="w-[220px]" data-testid="emp-filter-project">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="emp-filter-wagetype" className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Wage type
        </label>
        <Select id="emp-filter-wagetype" name="wageType" defaultValue={applied.wageType} className="w-[140px]" data-testid="emp-filter-wagetype">
          <option value="">All</option>
          <option value="MONTHLY">Monthly</option>
          <option value="DAILY">Daily</option>
        </Select>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClear} data-testid="emp-filter-clear">
          Clear filters
        </Button>
        <Button type="submit" size="sm" data-testid="emp-filter-apply">
          Apply
        </Button>
      </div>
    </form>
  );
}
