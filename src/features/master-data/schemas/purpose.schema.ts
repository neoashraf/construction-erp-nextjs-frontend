import { z } from "zod";

/** Add/rename purpose (spec §7; FR-MAS-011). Name required, trimmed, Bangla-capable. */
export const purposeSchema = z.object({
  name: z.string().trim().min(1, "Purpose name is required."),
});

export type PurposeFormValues = z.infer<typeof purposeSchema>;
