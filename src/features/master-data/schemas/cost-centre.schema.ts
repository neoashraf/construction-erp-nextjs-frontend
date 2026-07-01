import { z } from "zod";

/** Add/rename cost centre (spec §7; FR-MAS-010). Code required on add, name required. */
export const costCentreSchema = z.object({
  code: z.string().trim().min(1, "Code is required."),
  name: z.string().trim().min(1, "Name is required."),
});

export type CostCentreFormValues = z.infer<typeof costCentreSchema>;
