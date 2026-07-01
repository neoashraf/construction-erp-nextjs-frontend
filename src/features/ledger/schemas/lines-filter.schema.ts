import { z } from "zod";

/**
 * Account-ledger / drill-down filter form (spec §7). A query form, not a writing
 * form. `accountId` is optional at the schema level — its PRESENCE switches the
 * screen between account-ledger mode (opening + running balance) and drill-down mode
 * (both omitted). Client validation: `dateFrom` must not be after `dateTo` (mirrors
 * the API `400`, shown inline before firing). Dimensions/party/voucherType/source are
 * optional drill filters.
 */
export const linesFilterSchema = z
  .object({
    accountId: z.string().optional().or(z.literal("")),
    dateFrom: z.string().optional().or(z.literal("")),
    dateTo: z.string().optional().or(z.literal("")),
    voucherType: z.string().optional().or(z.literal("")),
    projectId: z.string().optional().or(z.literal("")),
    costCentreId: z.string().optional().or(z.literal("")),
    purposeId: z.string().optional().or(z.literal("")),
    godownId: z.string().optional().or(z.literal("")),
    partyId: z.string().optional().or(z.literal("")),
  })
  .refine(
    (v) => {
      if (!v.dateFrom || !v.dateTo) return true;
      return v.dateFrom <= v.dateTo; // ISO YYYY-MM-DD compares lexicographically
    },
    { path: ["dateFrom"], message: "Date from cannot be after date to." },
  );

export type LinesFilterFormValues = z.infer<typeof linesFilterSchema>;

/** Account-ledger mode = a single account is selected AND a date range is bounded. */
export function isAccountLedgerMode(v: {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
}): boolean {
  return !!v.accountId && !!v.dateFrom && !!v.dateTo;
}
