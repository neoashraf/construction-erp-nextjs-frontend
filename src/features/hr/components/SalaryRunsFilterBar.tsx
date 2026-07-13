"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { type FinancialYearOption, type SalarySheetStatus } from "../api/salary";

export interface SalaryRunsFilter {
  financialYearId: string;
  periodLabel: string;
  status: "" | SalarySheetStatus;
}

export const EMPTY_SALARY_FILTER: SalaryRunsFilter = {
  financialYearId: "",
  periodLabel: "",
  status: "",
};

/**
 * Runs-list filter bar (spec §4/§7). Financial year · period label · status. Uniform field
 * states — `Input`/`Select` primitives already carry `shadow-focus`/`shadow-focus-error`.
 * Clear resets to the empty applied filter (used by the "No runs match these filters."
 * empty-state CTA).
 */
export function SalaryRunsFilterBar({
  applied,
  financialYears,
  onApply,
  onClear,
}: {
  applied: SalaryRunsFilter;
  financialYears: FinancialYearOption[];
  onApply: (f: SalaryRunsFilter) => void;
  onClear: () => void;
}) {
  return (
    <Card className="mb-3 flex flex-wrap items-end gap-3 p-3" data-testid="salary-filter-bar">
      <div className="min-w-[160px] flex-1">
        <Label htmlFor="filter-fy" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Financial year
        </Label>
        <Select
          id="filter-fy"
          data-testid="filter-fy"
          value={applied.financialYearId}
          onChange={(e) => onApply({ ...applied, financialYearId: e.target.value })}
        >
          <option value="">All years</option>
          {financialYears.map((fy) => (
            <option key={fy.id} value={fy.id}>
              {fy.code}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-[160px] flex-1">
        <Label htmlFor="filter-period" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Period
        </Label>
        <Input
          id="filter-period"
          data-testid="filter-period"
          placeholder="e.g. 2026-06"
          value={applied.periodLabel}
          onChange={(e) => onApply({ ...applied, periodLabel: e.target.value })}
        />
      </div>
      <div className="min-w-[150px] flex-1">
        <Label htmlFor="filter-status" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Status
        </Label>
        <Select
          id="filter-status"
          data-testid="filter-status"
          value={applied.status}
          onChange={(e) => onApply({ ...applied, status: e.target.value as SalaryRunsFilter["status"] })}
        >
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="REVERSED">Reversed</option>
        </Select>
      </div>
      <Button size="sm" variant="outline" onClick={onClear} data-testid="filter-clear">
        Clear filters
      </Button>
    </Card>
  );
}
