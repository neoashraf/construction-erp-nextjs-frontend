import { z } from "zod";
import { type ProfitGroupBy } from "../types";

/**
 * Profitability filter (spec §7). A QUERY selection, not a writing form. Nothing is
 * required — the screen loads at the default `groupBy` (cost_centre) with no filter and
 * renders whatever the server returns (lifetime, per the CC omit-convention). Only
 * `dateFrom > dateTo` is validated client-side, mirroring the API `400 VALIDATION_ERROR`.
 */

export const PROFIT_GROUP_BY = ["cost_centre", "project", "project_cost_centre"] as const;

export const GROUP_BY_LABEL: Record<ProfitGroupBy, string> = {
  cost_centre: "By cost centre",
  project: "By project",
  project_cost_centre: "By project & cost centre",
};

export const profitabilityFilterSchema = z
  .object({
    groupBy: z.enum(PROFIT_GROUP_BY).default("cost_centre"),
    projectId: z.string().optional().or(z.literal("")),
    costCentreId: z.string().optional().or(z.literal("")),
    financialYearId: z.string().optional().or(z.literal("")),
    dateFrom: z.string().optional().or(z.literal("")),
    dateTo: z.string().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    // ISO YYYY-MM-DD compares lexicographically.
    if (v.dateFrom && v.dateTo && v.dateFrom > v.dateTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateFrom"], message: "'Date from' must be before 'Date to'." });
    }
  });

export type ProfitabilityFilterFormValues = z.infer<typeof profitabilityFilterSchema>;

/** A blank filter for a given grouping mode. */
export function emptyProfitabilityFilter(
  groupBy: ProfitGroupBy = "cost_centre",
  financialYearId = "",
): ProfitabilityFilterFormValues {
  return { groupBy, projectId: "", costCentreId: "", financialYearId, dateFrom: "", dateTo: "" };
}
