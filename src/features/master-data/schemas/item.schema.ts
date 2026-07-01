import { z } from "zod";
import { isNonNegativeMoney, parseMoney } from "@/lib/money";

/**
 * Item + UoM-conversion forms (spec §7; FR-MAS-025/026/027). Item: code (create) +
 * name + base UoM + default account required, H.S. code optional. Conversion: uom
 * required + factorToBase > 0 (Decimal(18,4), no float).
 */

export const itemSchema = z.object({
  code: z.string().trim().min(1, "Item code is required."),
  name: z.string().trim().min(1, "Item name is required."),
  baseUom: z.string().trim().min(1, "Base unit is required."),
  hsCode: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
  defaultAccountId: z.string().min(1, "Select a default account."),
});

export type ItemFormValues = z.infer<typeof itemSchema>;

export const uomConversionSchema = z.object({
  uom: z.string().trim().min(1, "Unit is required."),
  factorToBase: z
    .string()
    .trim()
    .min(1, "Factor is required.")
    .refine((v) => {
      try {
        const d = parseMoney(v);
        return isNonNegativeMoney(d) && d.greaterThan(0);
      } catch {
        return false;
      }
    }, "Factor must be greater than 0."),
});

export type UomConversionFormValues = z.infer<typeof uomConversionSchema>;
