import { z } from "zod";
import { isE164 } from "@/lib/format";

/**
 * SAMPLE zod schema + the form-wiring pattern (skill §6, ADR-0003 F4). This is a
 * reference pattern only — NOT a real screen form (screens come with their per-
 * screen briefs). It demonstrates:
 *  - a zod schema with BD-aware validators (E.164 phone, money scale),
 *  - the `resolver` wiring via @hookform/resolvers/zod (see useSampleForm below),
 *  - mapping a server `VALIDATION_ERROR` `details` map back onto fields.
 *
 * Money fields are validated as decimal STRINGS (never JS float) — scale ≤ 4.
 */

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a non-negative amount with up to 4 decimal places");

export const sampleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().refine(isE164, "Must be a valid E.164 phone (+880…)"),
  amount: moneyString,
});

export type SampleFormValues = z.infer<typeof sampleSchema>;

/**
 * Apply a server `VALIDATION_ERROR` `details` object onto react-hook-form. Pattern
 * for every real form: `details` is `{ field: message }` (overview §6). Returns
 * the list of (field, message) pairs to feed `setError`.
 */
export function mapValidationDetails(
  details: Record<string, unknown> | null | undefined,
): Array<{ field: string; message: string }> {
  if (!details) return [];
  return Object.entries(details).map(([field, message]) => ({
    field,
    message: typeof message === "string" ? message : "Invalid value",
  }));
}
