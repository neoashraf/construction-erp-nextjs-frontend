"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { formatDate } from "@/lib/format";
import { type ProjectOption } from "../types";
import { type CostCentreOption } from "../api/masters";

/**
 * Attendance filter bar (Attendance.dc.html — one horizontal row, Apply/Clear filters).
 * Date (DD/MM/YYYY, default today), project, cost centre. All three modes share this shell;
 * the cost-centre filter is only meaningful for the daily-labour + subcontractor modes but
 * stays visible so switching tabs preserves scope. Edits are local (draft) until Apply —
 * matches the mockup, and avoids re-querying on every keystroke/select.
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
  const [draft, setDraft] = useState(filter);

  // Reconcile the draft if the parent's applied filter changes for a reason other than
  // this bar's own Apply (e.g. an external reset) — keeps the visible controls truthful.
  useEffect(() => setDraft(filter), [filter]);

  function apply() {
    onChange(draft);
  }

  function clear() {
    const cleared: AttendanceFilter = { date: formatDate(new Date()), projectId: "", costCentreId: "" };
    setDraft(cleared);
    onChange(cleared);
  }

  return (
    <div
      className="mt-3.5 flex-none rounded-card border border-border bg-surface p-3.5 shadow-sm"
      data-testid="attendance-filter-bar"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-none flex-col gap-1.5">
          <Label htmlFor="att-date" className="text-[10.5px]">
            Date
          </Label>
          <DatePickerInput
            id="att-date"
            className="w-[150px]"
            value={draft.date}
            onChange={(v) => setDraft((d) => ({ ...d, date: v }))}
            aria-describedby="att-date-hint"
          />
        </div>
        <div className="flex flex-none flex-col gap-1.5">
          <Label htmlFor="att-project" className="text-[10.5px]">
            Project
          </Label>
          <Select
            id="att-project"
            data-testid="att-project"
            className="w-[230px]"
            value={draft.projectId}
            onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}
          >
            <option value="">All assigned projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-none flex-col gap-1.5">
          <Label htmlFor="att-cc" className="text-[10.5px]">
            Cost centre
          </Label>
          <Select
            id="att-cc"
            data-testid="att-cc"
            className="w-[190px]"
            value={draft.costCentreId}
            onChange={(e) => setDraft((d) => ({ ...d, costCentreId: e.target.value }))}
          >
            <option value="">All cost centres</option>
            {costCentres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1" />
        <div className="flex flex-none items-center gap-2">
          <Button size="md" onClick={apply} data-testid="attendance-filter-apply">
            Apply
          </Button>
          <Button variant="ghost" size="md" onClick={clear} data-testid="attendance-filter-clear">
            Clear filters
          </Button>
        </div>
      </div>
    </div>
  );
}
