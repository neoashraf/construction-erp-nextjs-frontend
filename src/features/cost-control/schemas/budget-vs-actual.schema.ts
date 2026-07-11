import { z } from "zod";

/**
 * Budget-vs-actual filter (spec §7). A QUERY form, not a writing form. The required
 * selector depends on the view mode (FR-CC-008): "By project" needs a `projectId`,
 * "By cost centre" needs a `costCentreId` — each blocks Apply with the exact spec §8
 * inline message. `dateFrom > dateTo` mirrors the API `400 VALIDATION_ERROR`, shown
 * inline before firing. Status is a multi-select over the four classifications.
 */

export const BVA_STATUSES = ["OK", "APPROACHING", "OVER", "UNBUDGETED"] as const;
export type BvaStatusFilter = (typeof BVA_STATUSES)[number];

export const BVA_STATUS_LABEL: Record<BvaStatusFilter, string> = {
  OK: "OK",
  APPROACHING: "Approaching",
  OVER: "Over budget",
  UNBUDGETED: "Unbudgeted",
};

export const budgetVsActualFilterSchema = z
  .object({
    viewMode: z.enum(["project", "cost_centre"]).default("project"),
    projectId: z.string().optional().or(z.literal("")),
    costCentreId: z.string().optional().or(z.literal("")),
    financialYearId: z.string().optional().or(z.literal("")),
    dateFrom: z.string().optional().or(z.literal("")),
    dateTo: z.string().optional().or(z.literal("")),
    status: z.array(z.enum(BVA_STATUSES)).default([...BVA_STATUSES]),
  })
  .superRefine((v, ctx) => {
    if (v.viewMode === "project" && !v.projectId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["projectId"], message: "Select a project." });
    }
    if (v.viewMode === "cost_centre" && !v.costCentreId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["costCentreId"], message: "Select a cost centre." });
    }
    // ISO YYYY-MM-DD compares lexicographically.
    if (v.dateFrom && v.dateTo && v.dateFrom > v.dateTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateFrom"], message: "'Date from' must be before 'Date to'." });
    }
  });

export type BudgetVsActualFilterFormValues = z.infer<typeof budgetVsActualFilterSchema>;

/** Serialise the status chip selection into the API's csv param — omit when all four are on. */
export function statusToApi(status: BvaStatusFilter[]): string | undefined {
  return status.length > 0 && status.length < BVA_STATUSES.length ? status.join(",") : undefined;
}
