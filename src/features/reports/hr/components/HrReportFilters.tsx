"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type ReportParams } from "../../types";
import { type HrReportTab } from "../types";

const SAMPLE_EMPLOYEES = [
  { id: "emp-1", label: "Ashraf Uddin" },
  { id: "emp-2", label: "Rahim Ali" },
  { id: "emp-3", label: "Karim Sheikh" },
];
const SAMPLE_RUNS = [
  { id: "run-1", label: "May 2026 · posted 05/06/2026" },
  { id: "run-2", label: "April 2026 · posted 05/05/2026" },
];

/**
 * FE-60 report-specific filters (spec §7):
 *   • ATTENDANCE_SUMMARY — Month (YYYY-MM, required) + Employee (optional).
 *   • SALARY_REGISTER — Salary run XOR (FY + Month), mutually exclusive
 *     announced via aria-live; Employee (optional).
 *   • PAYMENT_HISTORY — Date range + Employee (both dates required, the
 *     shared panel handles the range; we only add the Employee slot here).
 */
export function HrReportFilters({
  tab,
  value,
  onChange,
  monthError,
  runXorError,
}: {
  tab: HrReportTab;
  value: ReportParams;
  onChange: (next: ReportParams) => void;
  monthError?: string | null;
  runXorError?: string | null;
}) {
  const month = (value.extras?.month as string | undefined) ?? "";
  const employeeId = (value.extras?.employeeId as string | undefined) ?? "";
  const salaryRunId = (value.extras?.salaryRunId as string | undefined) ?? "";

  function setExtra(key: string, val: string | null) {
    onChange({
      ...value,
      extras: { ...(value.extras ?? {}), [key]: val ?? null },
    });
  }

  return (
    <div className="rounded-card border border-border bg-background p-4" data-testid="hr-filters">
      {tab === "ATTENDANCE_SUMMARY" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="hr-month">Month</Label>
            <Input
              id="hr-month"
              type="month"
              value={month}
              onChange={(e) => setExtra("month", e.target.value || null)}
              invalid={!!monthError}
              data-testid="hr-filter-month"
            />
            {monthError && (
              <p className="mt-1 text-[12px] text-destructive" role="alert" data-testid="hr-month-error">
                {monthError}
              </p>
            )}
          </div>
          <EmployeeSelect
            value={employeeId}
            onChange={(v) => setExtra("employeeId", v)}
          />
        </div>
      )}

      {tab === "SALARY_REGISTER" && (
        <fieldset>
          <legend className="text-[12px] font-semibold text-muted-foreground">
            Identify the period
          </legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="hr-run">Salary run</Label>
              <select
                id="hr-run"
                value={salaryRunId}
                onChange={(e) => {
                  const v = e.target.value || null;
                  // Selecting a run clears FY+month; setting month clears run.
                  if (v) {
                    onChange({
                      ...value,
                      extras: { ...(value.extras ?? {}), salaryRunId: v, month: null },
                    });
                  } else {
                    setExtra("salaryRunId", null);
                  }
                }}
                className={cn(
                  "mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none",
                  runXorError && "border-destructive shadow-focus-error",
                )}
                data-testid="hr-filter-run"
              >
                <option value="">Select a salary run…</option>
                {SAMPLE_RUNS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="hr-run-month">Month (with FY)</Label>
              <Input
                id="hr-run-month"
                type="month"
                value={month}
                onChange={(e) => {
                  const v = e.target.value || null;
                  if (v) {
                    onChange({
                      ...value,
                      extras: { ...(value.extras ?? {}), month: v, salaryRunId: null },
                    });
                  } else {
                    setExtra("month", null);
                  }
                }}
                invalid={!!runXorError}
                data-testid="hr-filter-run-month"
              />
            </div>
            <EmployeeSelect
              value={employeeId}
              onChange={(v) => setExtra("employeeId", v)}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
            Selecting a salary run clears the FY + month, and vice versa.
          </p>
          {runXorError && (
            <p className="mt-1 text-[12px] text-destructive" role="alert" data-testid="hr-xor-error">
              {runXorError}
            </p>
          )}
        </fieldset>
      )}

      {tab === "PAYMENT_HISTORY" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <EmployeeSelect
            value={employeeId}
            onChange={(v) => setExtra("employeeId", v)}
          />
        </div>
      )}
    </div>
  );
}

function EmployeeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <Label htmlFor="hr-employee">Employee</Label>
      <select
        id="hr-employee"
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
        data-testid="hr-filter-employee"
      >
        <option value="">All employees</option>
        {SAMPLE_EMPLOYEES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
    </div>
  );
}
