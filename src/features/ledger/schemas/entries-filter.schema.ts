import { z } from "zod";

/**
 * Journal-entries filter form (spec §7). A query form, not a writing form — no
 * posting capture. Client validation: `dateFrom` must not be after `dateTo` (mirrors
 * the API `400 date_from > date_to`, shown inline before firing — spec §7/§9). Dates
 * are `YYYY-MM-DD` (from native date inputs); rendered `DD/MM/YYYY` elsewhere.
 */
export const entriesFilterSchema = z
  .object({
    entryNo: z.string().trim().optional().or(z.literal("")),
    dateFrom: z.string().optional().or(z.literal("")),
    dateTo: z.string().optional().or(z.literal("")),
    voucherType: z.string().optional().or(z.literal("")),
    reversal: z.enum(["all", "normal", "reversal"]).default("all"),
  })
  .refine(
    (v) => {
      if (!v.dateFrom || !v.dateTo) return true;
      return v.dateFrom <= v.dateTo; // ISO YYYY-MM-DD compares lexicographically
    },
    { path: ["dateFrom"], message: "Date from cannot be after date to." },
  );

export type EntriesFilterFormValues = z.infer<typeof entriesFilterSchema>;

/** Map the tri-state reversal toggle → the API `isReversal` param (undefined = all). */
export function reversalToApi(reversal: "all" | "normal" | "reversal"): boolean | undefined {
  if (reversal === "reversal") return true;
  if (reversal === "normal") return false;
  return undefined;
}
