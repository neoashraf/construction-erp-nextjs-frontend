"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { isUnscopedRole } from "@/lib/auth/roles";
import { useCostCentreOptions, useFinancialYearOptions, useProjectOptions } from "../hooks/useMastersOptions";
import { validateReportParams, type ParamErrors } from "../schemas/report-params.schema";
import { type ReportDescriptor, type ReportParams } from "../types";

/**
 * FE-54 shared parameter panel — every viewer mounts this. Laid out per the
 * design as a **single horizontal filter row**: the primary params inline
 * (financial year, date range / as-of, group-by where applicable), ending with a
 * `Filters (N)` disclosure that holds the secondary params (project, cost centre,
 * report-specific extras), then `Run` + `Cancel`. Enforces:
 *   • as-of/period XOR date range (as-of/period wins, visually disables the range)
 *   • PM sees only assigned projects (server-scoped list; the FE trusts it)
 *   • Run disabled until required params are set
 * `onRun(params)` fires only when the local schema passes.
 */

/** Compact uppercase micro-label above a control (design's filter-row style). */
export function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

export const REPORT_SELECT_CLASS =
  "block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none";
const SELECT_CLASS = REPORT_SELECT_CLASS;

/** Report params store ISO `YYYY-MM-DD` (schema compares as sortable strings + the
 *  API forwards it verbatim); the shared DatePickerInput speaks `DD/MM/YYYY`. These
 *  bridge the two so the styled calendar field can drive the ISO-backed params. */
function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** A styled DD/MM/YYYY calendar field wired to an ISO-string report param. Holds
 *  the display text locally so partial manual typing ("01/07/…") isn't wiped;
 *  commits ISO to the param only once the text is a complete valid date (or empty).*/
function ReportDateField({
  id,
  iso,
  onIsoChange,
  disabled,
  invalid,
  testId,
}: {
  id: string;
  iso: string | null | undefined;
  onIsoChange: (iso: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  testId?: string;
}) {
  const [display, setDisplay] = useState(() => isoToDisplay(iso));
  // Re-sync when the param changes from outside (tab switch, Cancel, calendar pick).
  useEffect(() => {
    setDisplay((prev) => (displayToIso(prev) === (iso ?? null) ? prev : isoToDisplay(iso)));
  }, [iso]);
  return (
    <div data-testid={testId}>
      <DatePickerInput
        id={id}
        value={display}
        onChange={(next) => {
          setDisplay(next);
          const trimmed = next.trim();
          if (trimmed === "") onIsoChange(null);
          else {
            const asIso = displayToIso(trimmed);
            if (asIso) onIsoChange(asIso); // only commit complete valid dates
          }
        }}
        disabled={disabled}
        invalid={invalid}
      />
    </div>
  );
}

export function ReportParameterPanel({
  descriptor,
  value,
  onChange,
  onRun,
  running,
  disabled = false,
  primarySlot,
  leadingSlot,
}: {
  descriptor: ReportDescriptor;
  value: ReportParams;
  onChange: (next: ReportParams) => void;
  onRun: (params: ReportParams) => void;
  running: boolean;
  disabled?: boolean;
  /**
   * Optional report-specific control(s) rendered inline in the primary filter row,
   * AFTER the standard fields and before the Filters/Run/Cancel cluster — e.g. the
   * trial balance's "Group by" select.
   */
  primarySlot?: React.ReactNode;
  /**
   * Optional report-specific control(s) rendered inline at the START of the filter
   * row, before the Financial year field — e.g. the account ledger's Account +
   * Party selects, which the design shows first.
   */
  leadingSlot?: React.ReactNode;
}) {
  const user = useAuthenticatedUser();
  const fys = useFinancialYearOptions();
  const projects = useProjectOptions();
  const ccs = useCostCentreOptions();
  const [errors, setErrors] = useState<ParamErrors>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  function onCancel() {
    // Cancel clears the parameters back to just the active financial year.
    onChange({ financialYearId: value.financialYearId, extras: {} });
    setErrors({});
    setFiltersOpen(false);
  }

  const projectHelp = useMemo(() => {
    if (!descriptor.projectScoped) return null;
    if (isUnscopedRole(user.role)) return "All projects available.";
    return "Only your assigned projects appear here.";
  }, [descriptor.projectScoped, user.role]);

  // Count active secondary filters (project + cost centre + report-specific extras).
  const secondaryCount =
    (value.projectId ? 1 : 0) +
    (value.costCentreId ? 1 : 0) +
    descriptor.parameters.reduce((n, p) => {
      const v = value.extras?.[p.key];
      return n + (v !== undefined && v !== null && v !== "" ? 1 : 0);
    }, 0);
  const hasSecondary = descriptor.projectScoped || descriptor.parameters.length > 0 || true; // cost centre always present

  return (
    <Card className="p-4" data-testid="report-parameter-panel">
      <form onSubmit={submit} className="space-y-3">
        {/* Primary filter row — inline, one horizontal line that wraps only when narrow. */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Report-specific leading control(s), e.g. Account + Party. */}
          {leadingSlot}

          <div className="min-w-[180px] flex-1">
            <FieldLabel htmlFor="param-fy" required>
              Financial year
            </FieldLabel>
            <select
              id="param-fy"
              value={value.financialYearId}
              onChange={(e) => onChange({ ...value, financialYearId: e.target.value })}
              disabled={disabled || running}
              className={cn(SELECT_CLASS, errors.financialYearId && "border-destructive focus:shadow-focus-error")}
              data-testid="param-fy"
            >
              <option value="">Select a financial year…</option>
              {fys.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {descriptor.supportsAsOf && (
            <div className="min-w-[150px] flex-1">
              <FieldLabel htmlFor="param-as-of">As-of date</FieldLabel>
              <ReportDateField
                id="param-as-of"
                iso={value.asOf}
                onIsoChange={(iso) => onChange({ ...value, asOf: iso })}
                disabled={disabled || running}
                invalid={!!errors.asOf}
                testId="param-as-of"
              />
            </div>
          )}

          {descriptor.supportsDateRange && (
            <>
              <div className="min-w-[150px] flex-1">
                <FieldLabel htmlFor="param-date-from" required={!descriptor.supportsAsOf}>
                  Date from
                </FieldLabel>
                <ReportDateField
                  id="param-date-from"
                  iso={value.dateFrom}
                  onIsoChange={(iso) => onChange({ ...value, dateFrom: iso })}
                  disabled={disabled || running || rangeDisabled}
                  invalid={!!errors.dateFrom}
                  testId="param-date-from"
                />
              </div>
              <div className="min-w-[150px] flex-1">
                <FieldLabel htmlFor="param-date-to" required={!descriptor.supportsAsOf}>
                  Date to
                </FieldLabel>
                <ReportDateField
                  id="param-date-to"
                  iso={value.dateTo}
                  onIsoChange={(iso) => onChange({ ...value, dateTo: iso })}
                  disabled={disabled || running || rangeDisabled}
                  invalid={!!errors.dateTo}
                  testId="param-date-to"
                />
              </div>
            </>
          )}

          {/* Report-specific inline control(s), e.g. Group by. */}
          {primarySlot}

          {/* Filters disclosure + Run + Cancel, right-aligned on the same row. */}
          <div className="ml-auto flex items-end gap-2">
            {hasSecondary && (
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                disabled={disabled || running}
                aria-expanded={filtersOpen}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-token border border-border-strong bg-surface px-3 text-[13px] font-medium text-foreground transition-colors",
                  "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
                data-testid="report-filters-toggle"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                Filters
                {secondaryCount > 0 && (
                  <span className="rounded-pill bg-accent-soft px-1.5 text-[11px] font-semibold text-accent-ink">
                    {secondaryCount}
                  </span>
                )}
              </button>
            )}
            <Button type="submit" disabled={disabled || running} className="h-9 gap-1.5" data-testid="report-run">
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {running ? "Running…" : "Run"}
            </Button>
            <button
              type="button"
              onClick={onCancel}
              disabled={disabled || running}
              className={cn(
                "inline-flex h-9 items-center rounded-token px-2 text-[13px] font-medium text-muted-foreground transition-colors",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              data-testid="report-cancel"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Field-level errors for the primary row. */}
        {(errors.financialYearId || errors.asOf || errors.dateFrom || errors.dateTo) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1" role="alert">
            {errors.financialYearId && (
              <p className="text-[12px] text-destructive">{errors.financialYearId}</p>
            )}
            {errors.asOf && <p className="text-[12px] text-destructive">{errors.asOf}</p>}
            {errors.dateFrom && <p className="text-[12px] text-destructive">{errors.dateFrom}</p>}
            {errors.dateTo && <p className="text-[12px] text-destructive">{errors.dateTo}</p>}
          </div>
        )}

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

        {/* Secondary filters, revealed by the Filters disclosure. */}
        {filtersOpen && (
          <div
            className="grid gap-4 rounded-card border border-border bg-surface-2 p-4 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="report-secondary-filters"
          >
            {descriptor.projectScoped && (
              <div>
                <FieldLabel htmlFor="param-project" required={descriptor.projectRequired}>
                  Project
                </FieldLabel>
                <select
                  id="param-project"
                  value={value.projectId ?? ""}
                  onChange={(e) => onChange({ ...value, projectId: e.target.value || null })}
                  disabled={disabled || running}
                  className={cn(SELECT_CLASS, errors.projectId && "border-destructive focus:shadow-focus-error")}
                  data-testid="param-project"
                >
                  <option value="">All projects</option>
                  {projects.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {projectHelp && <p className="mt-1 text-[11px] text-muted-foreground">{projectHelp}</p>}
                {errors.projectId && (
                  <p className="mt-1 text-[12px] text-destructive" role="alert">
                    {errors.projectId}
                  </p>
                )}
              </div>
            )}

            <div>
              <FieldLabel htmlFor="param-cc">Cost centre</FieldLabel>
              <select
                id="param-cc"
                value={value.costCentreId ?? ""}
                onChange={(e) => onChange({ ...value, costCentreId: e.target.value || null })}
                disabled={disabled || running}
                className={SELECT_CLASS}
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

            {descriptor.parameters.map((p) => (
              <div key={p.key}>
                <FieldLabel htmlFor={`extra-${p.key}`}>{p.label}</FieldLabel>
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
                    className={SELECT_CLASS}
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
        )}
      </form>
    </Card>
  );
}
