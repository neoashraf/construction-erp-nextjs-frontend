"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker";
import { type ProjectOption } from "../types";
import { type CostCentreOption } from "../api/masters";

/**
 * Attendance filter bar (spec §4). Date (DD/MM/YYYY, default today), project, cost centre.
 * All three modes share this shell; the cost-centre filter is only meaningful for the
 * daily-labour + subcontractor modes but stays visible so switching tabs preserves scope.
 */
export interface AttendanceFilter {
  date: string; // DD/MM/YYYY (form value)
  projectId: string;
  costCentreId: string;
}

export function AttendanceFilterBar({
  filter,
  onChange,
  projects,
  costCentres,
}: {
  filter: AttendanceFilter;
  onChange: (next: AttendanceFilter) => void;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
}) {
  return (
    <div
      className="mb-3 grid gap-3 rounded-card border border-border bg-surface p-3 sm:grid-cols-[minmax(140px,180px)_minmax(180px,1fr)_minmax(180px,1fr)]"
      data-testid="attendance-filter-bar"
    >
      <div>
        <Label htmlFor="att-date" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
          Date
        </Label>
        <DatePickerInput
          id="att-date"
          value={filter.date}
          onChange={(v) => onChange({ ...filter, date: v })}
          aria-describedby="att-date-hint"
        />
      </div>
      <div>
        <Label htmlFor="att-project" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
          Project
        </Label>
        <Select
          id="att-project"
          data-testid="att-project"
          value={filter.projectId}
          onChange={(e) => onChange({ ...filter, projectId: e.target.value })}
        >
          <option value="">All assigned projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="att-cc" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
          Cost centre
        </Label>
        <Select
          id="att-cc"
          data-testid="att-cc"
          value={filter.costCentreId}
          onChange={(e) => onChange({ ...filter, costCentreId: e.target.value })}
        >
          <option value="">All cost centres</option>
          {costCentres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
