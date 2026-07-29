"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useEmployeeOptions, useSalaryRunOptions } from "../../hooks/useMastersOptions";
import { type ReportParams } from "../../types";
import { type AttendanceLevel, type HrReportTab } from "../types";

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
  level = "SUMMARY",
  value,
  onChange,
  monthError,
  runXorError,
  dateError,
  inline = false,
}: {
  tab: HrReportTab;
  /** FE-66 — the attendance detail level whose parameter set is shown. */
  level?: AttendanceLevel;
  value: ReportParams;
  onChange: (next: ReportParams) => void;
  monthError?: string | null;
  runXorError?: string | null;
  dateError?: string | null;
  /**
   * FE-66 — render as bare flex items for the shared panel's leading slot, so the
   * attendance parameters sit on the panel's ONE horizontal filter row (the
   * design's frame 1) instead of in a second card below it.
   */
  inline?: boolean;
}) {
  const month = (value.extras?.month as string | undefined) ?? "";
  const employeeId = (value.extras?.employeeId as string | undefined) ?? "";
  const salaryRunId = (value.extras?.salaryRunId as string | undefined) ?? "";
  const salaryRuns = useSalaryRunOptions().data ?? [];

  function setExtra(key: string, val: string | null) {
    onChange({
      ...value,
      extras: { ...(value.extras ?? {}), [key]: val ?? null },
    });
  }

  // Inline: bare flex items that join the shared panel's own filter row.
  // Standalone: the bordered card the other two reports keep.
  const fieldRow = inline
    ? "contents"
    : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  const fieldCell = inline ? "min-w-[170px] flex-1" : "";

  return (
    <div
      className={
        inline ? "contents" : "rounded-card border border-border bg-background p-4"
      }
      data-testid="hr-filters"
    >
      {tab === "ATTENDANCE_SUMMARY" && (
        <>
          {/*
            FE-66 — the parameter set follows the DETAIL LEVEL (spec §7):
              • Summary → Month (required) · Project · Employee · Subcontractor party
              • Daily / Range → Date from · Date to · Project · (Cost centre at Range)
            The period and the level move together (spec §9), so the fields a
            level cannot use are not merely disabled — they are not shown.
          */}
          {level === "SUMMARY" ? (
            <div className={fieldRow}>
              <div className={fieldCell}>
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
              <EmployeeSelect className={fieldCell} value={employeeId} onChange={(v) => setExtra("employeeId", v)} />
            </div>
          ) : (
            <div className={fieldRow}>
              <div className={fieldCell}>
                <Label htmlFor="hr-date-from">Date from</Label>
                <Input
                  id="hr-date-from"
                  type="date"
                  value={value.dateFrom ?? ""}
                  onChange={(e) => onChange({ ...value, dateFrom: e.target.value || null })}
                  invalid={!!dateError}
                  data-testid="hr-filter-date-from"
                />
              </div>
              <div className={fieldCell}>
                <Label htmlFor="hr-date-to">Date to</Label>
                <Input
                  id="hr-date-to"
                  type="date"
                  value={value.dateTo ?? ""}
                  onChange={(e) => onChange({ ...value, dateTo: e.target.value || null })}
                  invalid={!!dateError}
                  data-testid="hr-filter-date-to"
                />
              </div>
              <EmployeeSelect className={fieldCell} value={employeeId} onChange={(v) => setExtra("employeeId", v)} />
              {dateError && (
                <p
                  className={cn(
                    "text-[12px] text-destructive",
                    inline ? "w-full" : "sm:col-span-2 lg:col-span-3",
                  )}
                  role="alert"
                  data-testid="hr-range-date-error"
                >
                  {dateError}
                </p>
              )}
              {/*
                The server clamps the window to today: days that have not happened
                cannot have been worked, and counting them would invent an absence
                for every employee (contract 12 § Attendance reports).
              */}
              <p
                className={cn(
                  "text-[11.5px] text-muted-foreground",
                  inline ? "w-full" : "sm:col-span-2 lg:col-span-3",
                )}
                data-testid="hr-range-clamped-note"
              >
                {"This report stops at today — future dates aren't counted as absences."}
              </p>
            </div>
          )}
        </>
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
                {salaryRuns.map((r) => (
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
  className,
}: {
  value: string;
  onChange: (v: string | null) => void;
  className?: string;
}) {
  const employees = useEmployeeOptions().data ?? [];
  return (
    <div className={className}>
      <Label htmlFor="hr-employee">Employee</Label>
      <select
        id="hr-employee"
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
        data-testid="hr-filter-employee"
      >
        <option value="">All employees</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
    </div>
  );
}
