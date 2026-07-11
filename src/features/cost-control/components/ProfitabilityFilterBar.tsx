"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  profitabilityFilterSchema,
  emptyProfitabilityFilter,
  type ProfitabilityFilterFormValues,
} from "../schemas/profitability.schema";
import {
  type CostCentreOption,
  type FinancialYearOption,
  type ProfitGroupBy,
  type ProjectOption,
} from "../types";

/**
 * Profitability filter bar (spec §4/§7; design file filter row). One dense row: Project ·
 * Cost centre · Financial year · a "Filters" disclosure holding the date range · Apply ·
 * Clear. A QUERY form — Apply fires on submit only. `dateFrom > dateTo` validates inline
 * (zod §superRefine). The grouping mode lives in the page header (GroupingModeControl),
 * not here; it is carried through as a hidden value so a fresh mode's filters persist.
 */
export function ProfitabilityFilterBar({
  groupBy,
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
  groupBy: ProfitGroupBy;
  defaults: ProfitabilityFilterFormValues;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  financialYears: FinancialYearOption[];
  optionsLoading: boolean;
  offline: boolean;
  projectScopeError?: string | null;
  onApply: (values: ProfitabilityFilterFormValues) => void;
  onClear: () => void;
}) {
  const [showDates, setShowDates] = useState(!!defaults.dateFrom || !!defaults.dateTo);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProfitabilityFilterFormValues>({
    resolver: zodResolver(profitabilityFilterSchema),
    defaultValues: defaults,
  });

  const dateFrom = watch("dateFrom");
  const dateTo = watch("dateTo");

  function clearAll() {
    reset(emptyProfitabilityFilter(groupBy, ""));
    onClear();
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onApply)} noValidate data-testid="profit-filter-bar" aria-label="Filter profitability">
        <input type="hidden" {...register("groupBy")} value={groupBy} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <Label htmlFor="profit-project">Project</Label>
            <Select id="profit-project" disabled={optionsLoading} data-testid="profit-project" {...register("projectId")}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <Label htmlFor="profit-cost-centre">Cost centre</Label>
            <Select id="profit-cost-centre" disabled={optionsLoading} data-testid="profit-cost-centre" {...register("costCentreId")}>
              <option value="">All cost centres</option>
              {costCentres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                  {c.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-[160px] flex-col gap-1.5">
            <Label htmlFor="profit-fy">Financial year</Label>
            <Select id="profit-fy" data-testid="profit-fy" {...register("financialYearId")}>
              <option value="">All years</option>
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="gap-1.5"
              aria-expanded={showDates}
              onClick={() => setShowDates((s) => !s)}
              data-testid="profit-filters-toggle"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
              {(dateFrom || dateTo) && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-soft px-1 text-[10px] font-bold text-accent-ink">
                  {(dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
                </span>
              )}
            </Button>
            <Button type="submit" size="md" disabled={offline} data-testid="profit-apply">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="profit-clear">
              Clear filters
            </Button>
          </div>
        </div>

        {showDates && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3" data-testid="profit-date-filters">
            <div className="flex min-w-[150px] flex-col gap-1.5">
              <Label htmlFor="profit-date-from">Date from</Label>
              <Input
                id="profit-date-from"
                type="date"
                className="tabular-nums"
                invalid={!!errors.dateFrom}
                data-testid="profit-date-from"
                {...register("dateFrom")}
              />
            </div>
            <div className="flex min-w-[150px] flex-col gap-1.5">
              <Label htmlFor="profit-date-to">Date to</Label>
              <Input
                id="profit-date-to"
                type="date"
                className="tabular-nums"
                invalid={!!errors.dateFrom}
                data-testid="profit-date-to"
                {...register("dateTo")}
              />
            </div>
          </div>
        )}

        {errors.dateFrom && (
          <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="profit-date-error">
            {errors.dateFrom.message}
          </p>
        )}

        {projectScopeError && (
          <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="profit-project-scope-error">
            {projectScopeError}
          </p>
        )}
      </form>
    </Card>
  );
}
