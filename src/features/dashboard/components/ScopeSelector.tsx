"use client";

import { Label } from "@/components/ui/label";
import { isRole, isUnscopedRole } from "@/lib/auth/roles";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { useFinancialYearOptions, useProjectOptions } from "../hooks/useMastersOptions";
import { type DashboardScope } from "../types";

/**
 * FE-61 scope selector — Financial-year + Project, matching the dashboard design
 * file: uppercase micro-labels over 36px-high selects, no Apply button (a change
 * re-fetches every tile), and a trailing "no Apply" hint. Project-scoped callers
 * (PM / Site Engineer) see only assigned projects with an "assigned only" note;
 * default is "All my projects" (no `projectId` sent). Accounts / Admin see "All
 * projects" + the full server-filtered list.
 */
export function ScopeSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: DashboardScope;
  onChange: (next: DashboardScope) => void;
  disabled?: boolean;
}) {
  const user = useAuthenticatedUser();
  const fys = useFinancialYearOptions();
  const projects = useProjectOptions();
  const roleUnscoped = isRole(user.role) ? isUnscopedRole(user.role) : true;
  const allProjectsLabel = roleUnscoped ? "All projects" : "All my projects";

  return (
    <div className="mt-3.5 flex flex-wrap items-end gap-3.5" data-testid="dash-scope">
      <div className="flex flex-col gap-[5px]">
        <Label htmlFor="dash-fy" className="text-[10.5px] tracking-[0.4px]">
          Financial year
        </Label>
        <select
          id="dash-fy"
          disabled={disabled}
          value={value.financialYearId}
          onChange={(e) => onChange({ ...value, financialYearId: e.target.value })}
          className="h-9 w-[250px] rounded-token border border-border-strong bg-background px-[11px] text-[13px] font-medium text-foreground hover:border-border-hover focus:border-accent focus:shadow-focus focus:outline-none disabled:opacity-55"
          data-testid="dash-fy"
        >
          <option value="">Select a financial year…</option>
          {fys.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-[5px]">
        <Label htmlFor="dash-project" className="text-[10.5px] tracking-[0.4px]">
          Project
        </Label>
        <select
          id="dash-project"
          disabled={disabled}
          value={value.projectId ?? ""}
          onChange={(e) => onChange({ ...value, projectId: e.target.value || null })}
          className="h-9 w-[250px] rounded-token border border-border-strong bg-background px-[11px] text-[13px] font-medium text-foreground hover:border-border-hover focus:border-accent focus:shadow-focus focus:outline-none disabled:opacity-55"
          data-testid="dash-project"
        >
          <option value="">{allProjectsLabel}</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {!roleUnscoped && (
        <div className="flex h-9 items-center rounded-token bg-warning-soft px-[11px]">
          <span className="text-[11.5px] font-semibold text-warning-ink">Assigned projects only</span>
        </div>
      )}
      <div className="flex-1" />
      <span className="self-center whitespace-nowrap text-[11.5px] text-faint">
        Changing scope re-fetches every tile — no Apply.
      </span>
    </div>
  );
}
