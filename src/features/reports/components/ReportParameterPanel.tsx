"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { isUnscopedRole } from "@/lib/auth/roles";
import { useCostCentreOptions, useFinancialYearOptions, useProjectOptions } from "../hooks/useMastersOptions";
import { validateReportParams, type ParamErrors } from "../schemas/report-params.schema";
import { type ReportDescriptor, type ReportParams } from "../types";

/**
 * FE-54 shared parameter panel — every viewer mounts this. Enforces:
 *   • as-of/period XOR date range (as-of/period wins, visually disables the range)
 *   • PM sees only assigned projects (server-scoped list; the FE trusts it)
 *   • Run disabled until required params are set
 * `onRun(params)` fires only when the local schema passes.
 */
export function ReportParameterPanel({
  descriptor,
  value,
  onChange,
  onRun,
  running,
  disabled = false,
}: {
  descriptor: ReportDescriptor;
  value: ReportParams;
  onChange: (next: ReportParams) => void;
  onRun: (params: ReportParams) => void;
  running: boolean;
  disabled?: boolean;
}) {
  const user = useAuthenticatedUser();
  const fys = useFinancialYearOptions();
  const projects = useProjectOptions();
  const ccs = useCostCentreOptions();
  const [errors, setErrors] = useState<ParamErrors>({});

  // Seed FY from the shell's active FY on first mount, if the caller hasn't set one.
  useEffect(() => {
    if (!value.financialYearId && user.financialYearId) {
      onChange({ ...value, financialYearId: user.financialYearId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const asOfActive = !!(value.asOf || value.periodId);
  // Only show the precedence note when BOTH controls are available on this report
  // (as-of alone on a balance-sheet-style report has nothing to override).
  const rangeDisabled = asOfActive && !!descriptor.supportsAsOf && !!descriptor.supportsDateRange;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateReportParams(descriptor, value);
    setErrors(result.errors);
    if (result.ok) onRun(value);
  }

  const projectHelp = useMemo(() => {
    if (!descriptor.projectScoped) return null;
    if (isUnscopedRole(user.role)) return "All projects available.";
    return "Only your assigned projects appear here.";
  }, [descriptor.projectScoped, user.role]);

  return (
    <Card className="p-5" data-testid="report-parameter-panel">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="param-fy">Financial year</Label>
            <select
              id="param-fy"
              value={value.financialYearId}
              onChange={(e) => onChange({ ...value, financialYearId: e.target.value })}
              disabled={disabled || running}
              className={cn(
                "mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground",
                "focus:border-accent focus:shadow-focus focus:outline-none",
                errors.financialYearId && "border-destructive focus:shadow-focus-error",
              )}
              data-testid="param-fy"
            >
              <option value="">Select a financial year…</option>
              {fys.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            {errors.financialYearId && (
              <p className="mt-1 text-[12px] text-destructive" role="alert">
                {errors.financialYearId}
              </p>
            )}
          </div>

          {descriptor.projectScoped && (
            <div>
              <Label htmlFor="param-project">
                Project{descriptor.projectRequired && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
              <select
                id="param-project"
                value={value.projectId ?? ""}
                onChange={(e) =>
                  onChange({ ...value, projectId: e.target.value || null })
                }
                disabled={disabled || running}
                className={cn(
                  "mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground",
                  "focus:border-accent focus:shadow-focus focus:outline-none",
                  errors.projectId && "border-destructive focus:shadow-focus-error",
                )}
                data-testid="param-project"
              >
                <option value="">All projects</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {projectHelp && (
                <p className="mt-1 text-[11px] text-muted-foreground">{projectHelp}</p>
              )}
              {errors.projectId && (
                <p className="mt-1 text-[12px] text-destructive" role="alert">
                  {errors.projectId}
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="param-cc">Cost centre</Label>
            <select
              id="param-cc"
              value={value.costCentreId ?? ""}
              onChange={(e) =>
                onChange({ ...value, costCentreId: e.target.value || null })
              }
              disabled={disabled || running}
              className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
              data-testid="param-cc"
            >
              <option value="">All cost centres</option>
              {ccs.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {descriptor.supportsDateRange && (
            <>
              <div>
                <Label htmlFor="param-date-from">Date from</Label>
                <Input
                  id="param-date-from"
                  type="date"
                  value={value.dateFrom ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, dateFrom: e.target.value || null })
                  }
                  disabled={disabled || running || rangeDisabled}
                  invalid={!!errors.dateFrom}
                  data-testid="param-date-from"
                />
                {errors.dateFrom && (
                  <p className="mt-1 text-[12px] text-destructive" role="alert">
                    {errors.dateFrom}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="param-date-to">Date to</Label>
                <Input
                  id="param-date-to"
                  type="date"
                  value={value.dateTo ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, dateTo: e.target.value || null })
                  }
                  disabled={disabled || running || rangeDisabled}
                  invalid={!!errors.dateTo}
                  data-testid="param-date-to"
                />
                {errors.dateTo && (
                  <p className="mt-1 text-[12px] text-destructive" role="alert">
                    {errors.dateTo}
                  </p>
                )}
              </div>
            </>
          )}

          {descriptor.supportsAsOf && (
            <div>
              <Label htmlFor="param-as-of">As-of date</Label>
              <Input
                id="param-as-of"
                type="date"
                value={value.asOf ?? ""}
                onChange={(e) =>
                  onChange({ ...value, asOf: e.target.value || null })
                }
                disabled={disabled || running}
                invalid={!!errors.asOf}
                data-testid="param-as-of"
              />
              {errors.asOf && (
                <p className="mt-1 text-[12px] text-destructive" role="alert">
                  {errors.asOf}
                </p>
              )}
            </div>
          )}

          {/* Dynamic report-specific filter slot. */}
          {descriptor.parameters.map((p) => (
            <div key={p.key}>
              <Label htmlFor={`extra-${p.key}`}>{p.label}</Label>
              {p.kind === "select" ? (
                <select
                  id={`extra-${p.key}`}
                  value={(value.extras?.[p.key] as string) ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      extras: { ...(value.extras ?? {}), [p.key]: e.target.value || null },
                    })
                  }
                  disabled={disabled || running}
                  className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
                  data-testid={`extra-${p.key}`}
                >
                  <option value="">Select…</option>
                  {p.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={`extra-${p.key}`}
                  type={p.kind === "boolean" ? "checkbox" : "text"}
                  value={(value.extras?.[p.key] as string) ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      extras: { ...(value.extras ?? {}), [p.key]: e.target.value },
                    })
                  }
                  disabled={disabled || running}
                  invalid={!!errors.extras?.[p.key]}
                  data-testid={`extra-${p.key}`}
                />
              )}
              {p.helper && <p className="mt-1 text-[11px] text-muted-foreground">{p.helper}</p>}
              {errors.extras?.[p.key] && (
                <p className="mt-1 text-[12px] text-destructive" role="alert">
                  {errors.extras[p.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        {rangeDisabled && (
          <div
            className="rounded-card border border-info-soft bg-info-soft/60 px-3 py-2 text-[12px] text-info-ink"
            role="status"
            aria-live="polite"
            data-testid="asof-precedence-note"
          >
            An as-of date takes precedence — the date range is ignored.
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="submit"
            disabled={disabled || running}
            className="gap-1.5"
            data-testid="report-run"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
            {running ? "Running…" : "Run report"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
