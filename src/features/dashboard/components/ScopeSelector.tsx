"use client";

import { Label } from "@/components/ui/label";
import { isRole, isUnscopedRole } from "@/lib/auth/roles";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { useFinancialYearOptions, useProjectOptions } from "../hooks/useMastersOptions";
import { type DashboardScope } from "../types";

/**
 * FE-61 scope selector — Financial-year + Project. Project-scoped callers
 * (PM / Site Engineer) see only assigned projects; default is "All my
 * projects" (no `projectId` sent). Accounts / Admin see "All projects" +
 * the full list (server-filtered).
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
    <div className="flex flex-wrap items-end gap-3" data-testid="dash-scope">
      <div className="min-w-[220px]">
        <Label htmlFor="dash-fy">Financial year</Label>
        <select
          id="dash-fy"
          disabled={disabled}
          value={value.financialYearId}
          onChange={(e) => onChange({ ...value, financialYearId: e.target.value })}
          className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
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
      <div className="min-w-[260px]">
        <Label htmlFor="dash-project">Project</Label>
        <select
          id="dash-project"
          disabled={disabled}
          value={value.projectId ?? ""}
          onChange={(e) => onChange({ ...value, projectId: e.target.value || null })}
          className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
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
    </div>
  );
}
