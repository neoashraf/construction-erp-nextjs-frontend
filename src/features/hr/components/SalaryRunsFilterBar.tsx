"use client";

import { useEffect, useState } from "react";
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
 * Runs-list filter bar (Salary Sheet.dc.html — one horizontal row, Apply/Clear filters).
 * Financial year · period label · status. Edits are local (draft) until Apply, matching
 * the mockup and the Attendance filter bar's pattern — avoids re-querying on every
 * keystroke/select. Clear resets to the empty applied filter immediately.
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
  const [draft, setDraft] = useState(applied);

  useEffect(() => setDraft(applied), [applied]);

  function clear() {
    setDraft(EMPTY_SALARY_FILTER);
    onClear();
  }

  return (
    <Card className="mb-3 flex flex-wrap items-end gap-3 p-3.5" data-testid="salary-filter-bar">
      <div className="min-w-[160px] flex-1">
        <Label htmlFor="filter-fy" className="mb-1 block text-[10.5px]">
          Financial year
        </Label>
        <Select
          id="filter-fy"
          data-testid="filter-fy"
          value={draft.financialYearId}
          onChange={(e) => setDraft((d) => ({ ...d, financialYearId: e.target.value }))}
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
        <Label htmlFor="filter-period" className="mb-1 block text-[10.5px]">
          Period
        </Label>
        <Input
          id="filter-period"
          data-testid="filter-period"
          placeholder="e.g. 2026-06"
          value={draft.periodLabel}
          onChange={(e) => setDraft((d) => ({ ...d, periodLabel: e.target.value }))}
        />
      </div>
      <div className="min-w-[150px] flex-1">
        <Label htmlFor="filter-status" className="mb-1 block text-[10.5px]">
          Status
        </Label>
        <Select
          id="filter-status"
          data-testid="filter-status"
          value={draft.status}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as SalaryRunsFilter["status"] }))}
        >
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="REVERSED">Reversed</option>
        </Select>
      </div>
      <div className="flex flex-none items-center gap-2">
        <Button size="md" onClick={() => onApply(draft)} data-testid="filter-apply">
          Apply
        </Button>
        <Button variant="ghost" size="md" onClick={clear} data-testid="filter-clear">
          Clear filters
        </Button>
      </div>
    </Card>
  );
}
