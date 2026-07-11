"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  budgetVsActualFilterSchema,
  BVA_STATUSES,
  BVA_STATUS_LABEL,
  type BvaStatusFilter,
  type BudgetVsActualFilterFormValues,
} from "../schemas/budget-vs-actual.schema";
import {
  type CostCentreOption,
  type FinancialYearOption,
  type ProjectOption,
  type ViewMode,
} from "../types";

/** A blank filter for a given view mode (fixed selector empty, all statuses on). */
export function emptyFilter(mode: ViewMode, financialYearId = ""): BudgetVsActualFilterFormValues {
  return {
    viewMode: mode,
    projectId: "",
    costCentreId: "",
    financialYearId,
    dateFrom: "",
    dateTo: "",
    status: [...BVA_STATUSES],
  };
}

/**
 * Budget-vs-actual filter bar (spec §4/§7/§9; design file filter card). One dense row:
 * the mode-dependent fixed selector (Project OR Cost centre) · Financial year · Status
 * chips · a "Filters" disclosure holding the date range · Apply · Clear. A QUERY form —
 * Apply fires on submit only (no auto-fetch). The required selector + `dateFrom>dateTo`
 * validate inline (zod §superRefine) before firing. The lifetime-vs-window note shows
 * whenever a FY or date filter is applied (§8), associated to those controls via
 * `aria-describedby`. Uniform field states via the shared Input/Select primitives.
 */
export function BudgetVsActualFilterBar({
  mode,
  defaults,
  projects,
  costCentres,
  financialYears,
  optionsLoading,
  offline,
  projectScopeError,
  onApply,
  onClear,
}: {
  mode: ViewMode;
  defaults: BudgetVsActualFilterFormValues;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  financialYears: FinancialYearOption[];
  optionsLoading: boolean;
  offline: boolean;
  projectScopeError?: string | null;
  onApply: (values: BudgetVsActualFilterFormValues) => void;
  onClear: () => void;
}) {
  const [showDates, setShowDates] = useState(!!defaults.dateFrom || !!defaults.dateTo);
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<BudgetVsActualFilterFormValues>({
    resolver: zodResolver(budgetVsActualFilterSchema),
    defaultValues: defaults,
  });

  const fyId = watch("financialYearId");
  const dateFrom = watch("dateFrom");
  const dateTo = watch("dateTo");
  const windowApplied = !!fyId || !!dateFrom || !!dateTo;

  function clearAll() {
    reset(emptyFilter(mode, ""));
    onClear();
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onApply)} noValidate data-testid="bva-filter-bar" aria-label="Filter budget vs actual">
        <input type="hidden" {...register("viewMode")} value={mode} />
        <div className="flex flex-wrap items-end gap-3">
          {/* fixed dimension selector (mode-dependent) */}
          {mode === "project" ? (
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <Label htmlFor="bva-project">Project</Label>
              <Select
                id="bva-project"
                invalid={!!errors.projectId}
                disabled={optionsLoading}
                data-testid="bva-project"
                {...register("projectId")}
              >
                <option value="">{optionsLoading ? "Loading projects…" : "Select a project…"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                  </option>
                ))}
              </Select>
              {errors.projectId && (
                <p className="text-[11.5px] text-destructive-ink" data-testid="bva-project-error">
                  {errors.projectId.message}
                </p>
              )}
            </div>
          ) : (
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <Label htmlFor="bva-cost-centre">Cost centre</Label>
              <Select
                id="bva-cost-centre"
                invalid={!!errors.costCentreId}
                disabled={optionsLoading}
                data-testid="bva-cost-centre"
                {...register("costCentreId")}
              >
                <option value="">{optionsLoading ? "Loading cost centres…" : "Select a cost centre…"}</option>
                {costCentres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                    {c.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </Select>
              {errors.costCentreId && (
                <p className="text-[11.5px] text-destructive-ink" data-testid="bva-cost-centre-error">
                  {errors.costCentreId.message}
                </p>
              )}
            </div>
          )}

          {/* financial year */}
          <div className="flex min-w-[160px] flex-col gap-1.5">
            <Label htmlFor="bva-fy">Financial year</Label>
            <Select id="bva-fy" aria-describedby="bva-window-note" data-testid="bva-fy" {...register("financialYearId")}>
              <option value="">All years — lifetime</option>
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.label}
                </option>
              ))}
            </Select>
          </div>

          {/* status chips */}
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <Label id="bva-status-label">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <div role="group" aria-labelledby="bva-status-label" className="flex flex-wrap gap-1.5" data-testid="bva-status">
                  {BVA_STATUSES.map((s) => {
                    const checked = field.value.includes(s);
                    return (
                      <StatusChip
                        key={s}
                        status={s}
                        checked={checked}
                        onToggle={() => {
                          const next: BvaStatusFilter[] = checked
                            ? field.value.filter((v) => v !== s)
                            : [...field.value, s];
                          field.onChange(next);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            />
          </div>

          {/* actions */}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="gap-1.5"
              aria-expanded={showDates}
              onClick={() => setShowDates((s) => !s)}
              data-testid="bva-filters-toggle"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
              {(dateFrom || dateTo) && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-soft px-1 text-[10px] font-bold text-accent-ink">
                  {(dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
                </span>
              )}
            </Button>
            <Button type="submit" size="md" disabled={offline} data-testid="bva-apply">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="bva-clear">
              Clear filters
            </Button>
          </div>
        </div>

        {/* date range disclosure */}
        {showDates && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3" data-testid="bva-date-filters">
            <div className="flex min-w-[150px] flex-col gap-1.5">
              <Label htmlFor="bva-date-from">Date from</Label>
              <Input
                id="bva-date-from"
                type="date"
                className="tabular-nums"
                invalid={!!errors.dateFrom}
                aria-describedby="bva-window-note"
                data-testid="bva-date-from"
                {...register("dateFrom")}
              />
            </div>
            <div className="flex min-w-[150px] flex-col gap-1.5">
              <Label htmlFor="bva-date-to">Date to</Label>
              <Input
                id="bva-date-to"
                type="date"
                className="tabular-nums"
                invalid={!!errors.dateFrom}
                data-testid="bva-date-to"
                {...register("dateTo")}
              />
            </div>
          </div>
        )}

        {errors.dateFrom && (
          <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="bva-date-error">
            {errors.dateFrom.message}
          </p>
        )}

        {projectScopeError && (
          <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="bva-project-scope-error">
            {projectScopeError}
          </p>
        )}

        {windowApplied && (
          <p
            id="bva-window-note"
            className="mt-3 flex items-start gap-2 rounded-card border border-info-soft bg-info-soft px-3 py-2 text-[12px] text-info-ink"
            data-testid="bva-window-note"
          >
            <Info className="mt-px h-3.5 w-3.5 flex-none" aria-hidden />
            <span>
              Budget status is always based on the project&apos;s full lifetime spend. This date filter only narrows the
              amounts shown below — it doesn&apos;t change the OK / Approaching / Over status.
            </span>
          </p>
        )}
      </form>
    </Card>
  );
}

function StatusChip({
  status,
  checked,
  onToggle,
}: {
  status: BvaStatusFilter;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      data-testid={`bva-status-${status}`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:shadow-focus",
        checked
          ? "border-accent-soft bg-accent-soft text-accent-ink"
          : "border-border-strong bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {BVA_STATUS_LABEL[status]}
    </button>
  );
}
