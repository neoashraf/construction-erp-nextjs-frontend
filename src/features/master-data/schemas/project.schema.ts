import { z } from "zod";
import { isNonNegativeMoney, parseMoney } from "@/lib/money";

/**
 * Project + budget + godown forms (spec §7). Project: code (create) + name +
 * customer + PM + start + expected-end required, expected-end > start. Budget:
 * cost centre + amount ≥ 0. Godown: name required.
 */

const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
function parseDmy(v: string): number | null {
  const m = DMY.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!));
  if (d.getUTCDate() !== +m[1]! || d.getUTCMonth() !== +m[2]! - 1) return null;
  return d.getTime();
}
// `toApiDate` (DD/MM/YYYY → YYYY-MM-DD) is shared — import it from financial-year.schema.

export const projectSchema = z
  .object({
    projectCode: z.string().trim().min(1, "Project code is required."),
    name: z.string().trim().min(1, "Project name is required."),
    location: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim()),
    customerId: z.string().min(1, "Select a customer."),
    projectManagerId: z.string().min(1, "Select a project manager."),
    startDate: z
      .string()
      .trim()
      .min(1, "Start date is required.")
      .refine((v) => parseDmy(v) !== null, "Enter a valid date (DD/MM/YYYY)."),
    expectedEndDate: z
      .string()
      .trim()
      .min(1, "Expected end date is required.")
      .refine((v) => parseDmy(v) !== null, "Enter a valid date (DD/MM/YYYY)."),
  })
  .superRefine((val, ctx) => {
    const s = parseDmy(val.startDate);
    const e = parseDmy(val.expectedEndDate);
    if (s !== null && e !== null && e <= s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expectedEndDate"],
        message: "Expected end date must be after the start date.",
      });
    }
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const budgetSchema = z.object({
  costCentreId: z.string().min(1, "Select a cost centre."),
  budgetedAmount: z
    .string()
    .trim()
    .min(1, "Amount is required.")
    .refine((v) => {
      try {
        return isNonNegativeMoney(parseMoney(v));
      } catch {
        return false;
      }
    }, "Enter an amount of 0 or more."),
});

export type BudgetFormValues = z.infer<typeof budgetSchema>;

export const godownSchema = z.object({
  name: z.string().trim().min(1, "Godown name is required."),
  location: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
});

export type GodownFormValues = z.infer<typeof godownSchema>;
