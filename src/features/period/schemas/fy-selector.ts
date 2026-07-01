import { z } from "zod";
import { MESSAGES } from "./errors";

/** The single in-page input this screen has — the required FY selector (spec §7). */
export const fySelectorSchema = z.object({
  financialYearId: z.string().trim().min(1, MESSAGES.selectFinancialYear),
});

export type FySelectorValues = z.infer<typeof fySelectorSchema>;
