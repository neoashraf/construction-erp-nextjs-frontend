import { z } from "zod";
import { isNonNegativeMoney, parseMoney } from "@/lib/money";

/**
 * Account-group + account modal forms (spec §7; FR-MAS-017/018/019/020). Group:
 * name required, type required. Account: code + name required, group required (which
 * auto-derives the type — FR-MAS-019), opening balance ≥ 0 (reference data, ৳).
 */

const ACCOUNT_TYPE = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);

export const accountGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required."),
  parentGroupId: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? v : null)),
  type: ACCOUNT_TYPE,
});

export type AccountGroupFormValues = z.infer<typeof accountGroupSchema>;

export const accountSchema = z.object({
  code: z.string().trim().min(1, "Account code is required."),
  name: z.string().trim().min(1, "Account name is required."),
  accountGroupId: z.string().min(1, "Select a group."),
  openingBalance: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => {
      if (v === "") return true;
      try {
        return isNonNegativeMoney(parseMoney(v));
      } catch {
        return false;
      }
    }, "Enter an amount of 0 or more."),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

export const ACCOUNT_TYPE_LABEL: Record<z.infer<typeof ACCOUNT_TYPE>, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};
