"use client";

import { Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { type FinancialYearOption } from "../api/masters";
import { type ProjectOption } from "../types";

/**
 * Register filter bar (spec §4/§7; design "chrome" band). Project picker gates the whole
 * screen (deep-link supplies `projectId` — otherwise "select a project" empty state); an
 * optional Financial-year filter narrows the register (omit → project-lifetime). Selections
 * commit immediately (`onChange`) — the register + retention panel re-fetch together (spec
 * §9 "shared project scope"). No Apply/Clear needed. PM's options are limited to assigned
 * projects (scoped server-side).
 */
export function RegisterFilterBar({
  projectId,
  financialYearId,
  projects,
  financialYears,
  disabled,
  onChangeProject,
  onChangeFinancialYear,
}: {
  projectId: string;
  financialYearId: string;
  projects: ProjectOption[];
  financialYears: FinancialYearOption[];
  disabled?: boolean;
  onChangeProject: (id: string) => void;
  onChangeFinancialYear: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-[280px] flex-1">
        <Label htmlFor="reg-f-project">Project</Label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" aria-hidden>
            <Building2 className="h-4 w-4" />
          </span>
          <Select
            id="reg-f-project"
            value={projectId}
            onChange={(e) => onChangeProject(e.target.value)}
            disabled={disabled}
            data-testid="reg-f-project"
            className="pl-8"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="min-w-[180px]">
        <Label htmlFor="reg-f-fy">
          Financial year <span className="font-normal text-faint">· optional</span>
        </Label>
        <div className="mt-1.5">
          <Select
            id="reg-f-fy"
            value={financialYearId}
            onChange={(e) => onChangeFinancialYear(e.target.value)}
            disabled={disabled || !projectId}
            data-testid="reg-f-fy"
          >
            <option value="">All years · project lifetime</option>
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
