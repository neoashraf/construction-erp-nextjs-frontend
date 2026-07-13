import { z } from "zod";
import { isNonNegativeMoney, parseMoney } from "@/lib/money";

/**
 * Create/edit employee form (FR-HR-001; Employees.dc.html). Employee code required
 * (locked once referenced by attendance/salary — enforced in the UI); name required
 * (Bangla or English); designation required; wage type + amount required (amount ≥ 0);
 * TIN, when present, is exactly 12 digits (NBR); joining date required. Bank fields
 * and statutory toggles are optional. Values are strings in the form.
 */

const TIN_RE = /^\d{12}$/;
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

export const employeeSchema = z.object({
  employeeCode: z.string().trim().min(1, "Employee code is required."),
  name: z.string().trim().min(1, "Name is required."),
  designation: z.string().trim().min(1, "Designation is required."),
  department: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
  defaultProjectId: z.string(), // "" = Unassigned
  workBase: z.enum(["HEAD_OFFICE", "SITE"]),
  wageType: z.enum(["MONTHLY", "DAILY"]),
  wageAmount: z
    .string()
    .trim()
    .min(1, "Enter the wage amount.")
    .refine((v) => {
      try {
        return isNonNegativeMoney(parseMoney(v));
      } catch {
        return false;
      }
    }, "Enter an amount of 0 or more."),
  bankName: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
  bankAccountName: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
  bankAccountNo: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
  pfApplicable: z.boolean(),
  gratuityApplicable: z.boolean(),
  wppfApplicable: z.boolean(),
  tin: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || TIN_RE.test(v), "TIN must be exactly 12 digits."),
  joiningDate: z
    .string()
    .trim()
    .min(1, "Joining date is required.")
    .refine((v) => DATE_RE.test(v), "Use DD/MM/YYYY."),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

/** Reassign dialog (FR-HR-002): new project + effective date required; note optional. */
export const reassignSchema = z.object({
  projectId: z.string().trim().min(1, "Choose a project."),
  effectiveDate: z
    .string()
    .trim()
    .min(1, "Effective date is required.")
    .refine((v) => DATE_RE.test(v), "Use DD/MM/YYYY."),
  note: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
});

export type ReassignFormValues = z.infer<typeof reassignSchema>;
