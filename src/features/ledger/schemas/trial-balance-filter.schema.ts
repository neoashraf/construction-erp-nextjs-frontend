import { z } from "zod";

/**
 * Trial-balance filter form (spec §7). A query form, not a writing form — Apply-only
 * (no auto-fetch) against a heavy server-side aggregation. Client validation:
 * `dateFrom` must not be after `dateTo` (mirrors the API `400 VALIDATION_ERROR`,
 * shown inline before firing — spec §7/§9), mirroring `lines-filter.schema.ts`.
 * `groupBy` is a fixed multi-select set (API contract `group_by` csv enum); `account`
 * is the default and the set is otherwise open per the API (`project, cost_centre,
 * purpose, godown, party`).
 */

export const GROUP_BY_OPTIONS = [
  "account",
  "project",
  "cost_centre",
  "purpose",
  "godown",
  "party",
] as const;

export type GroupByOption = (typeof GROUP_BY_OPTIONS)[number];

export const GROUP_BY_LABEL: Record<GroupByOption, string> = {
  account: "Account",
  project: "Project",
  cost_centre: "Cost centre",
  purpose: "Purpose",
  godown: "Godown",
  party: "Party",
};

export const trialBalanceFilterSchema = z
  .object({
    financialYearId: z.string().optional().or(z.literal("")),
    periodId: z.string().optional().or(z.literal("")),
    dateFrom: z.string().optional().or(z.literal("")),
    dateTo: z.string().optional().or(z.literal("")),
    groupBy: z.array(z.enum(GROUP_BY_OPTIONS)).default(["account"]),
    projectId: z.string().optional().or(z.literal("")),
    costCentreId: z.string().optional().or(z.literal("")),
    purposeId: z.string().optional().or(z.literal("")),
    godownId: z.string().optional().or(z.literal("")),
    partyId: z.string().optional().or(z.literal("")),
    accountId: z.string().optional().or(z.literal("")),
    includeReversals: z.boolean().default(true),
  })
  .refine(
    (v) => {
      // A selected period takes precedence server-side; skip range validation once
      // it's set so the (now-disabled) range inputs never block Apply (spec §9).
      if (v.periodId) return true;
      if (!v.dateFrom || !v.dateTo) return true;
      return v.dateFrom <= v.dateTo; // ISO YYYY-MM-DD compares lexicographically
    },
    { path: ["dateFrom"], message: "Date from cannot be after date to." },
  );

export type TrialBalanceFilterFormValues = z.infer<typeof trialBalanceFilterSchema>;

/** Join the group-by chip selection into the API's csv `groupBy` param. */
export function groupByToApi(groupBy: GroupByOption[]): string {
  return (groupBy.length ? groupBy : ["account"]).join(",");
}
