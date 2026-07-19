import { type ReportDescriptor, type ReportParams } from "../types";

/**
 * FE-54 shared parameter validation (spec §5/§7/§9). Enforces:
 *  • FY required
 *  • as-of/period XOR date range (as-of/period takes precedence — the panel
 *    also disables the range fields visually, but the schema is the backstop)
 *  • dateFrom ≤ dateTo when range is used
 *  • report-specific `required` filters set
 */

export interface ParamErrors {
  financialYearId?: string;
  projectId?: string;
  costCentreId?: string;
  dateFrom?: string;
  dateTo?: string;
  asOf?: string;
  periodId?: string;
  /** Any report-specific field error (keyed by descriptor.key). */
  extras?: Record<string, string>;
}

export interface ValidationResult {
  ok: boolean;
  errors: ParamErrors;
}

export function validateReportParams(
  descriptor: ReportDescriptor,
  params: ReportParams,
): ValidationResult {
  const errors: ParamErrors = {};

  if (!params.financialYearId) errors.financialYearId = "Financial year is required.";

  const hasAsOf = !!(params.asOf || params.periodId);
  const hasRange = !!(params.dateFrom || params.dateTo);

  if (descriptor.supportsDateRange && !descriptor.supportsAsOf && !hasRange) {
    errors.dateFrom = "Choose a date range.";
  }
  if (descriptor.supportsAsOf && !descriptor.supportsDateRange && !hasAsOf) {
    errors.asOf = "Choose an as-of date or period.";
  }
  if (params.dateFrom && params.dateTo && params.dateFrom > params.dateTo) {
    errors.dateTo = "End date must be on or after the start date.";
  }

  // Only reports that genuinely need one project (e.g. Project P&L) block Run.
  // `projectScoped` alone means "can filter by project" — not mandatory — so a
  // company-wide report ("All projects") must still be runnable.
  if (descriptor.projectRequired && !params.projectId) {
    errors.projectId = "Project is required for this report.";
  }

  if (descriptor.parameters.length > 0) {
    const extras: Record<string, string> = {};
    for (const p of descriptor.parameters) {
      if (!p.required) continue;
      const value = params.extras?.[p.key];
      if (value === undefined || value === null || value === "") {
        extras[p.key] = `${p.label} is required.`;
      }
    }
    if (Object.keys(extras).length > 0) errors.extras = extras;
  }

  const ok = Object.keys(errors).length === 0;
  return { ok, errors };
}

/** True when Run is ready — no errors AND no missing required params. */
export function canRun(descriptor: ReportDescriptor, params: ReportParams): boolean {
  return validateReportParams(descriptor, params).ok;
}
