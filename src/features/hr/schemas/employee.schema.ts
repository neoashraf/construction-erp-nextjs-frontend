import { z } from "zod";
import Decimal from "decimal.js";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type Employee, type WageType, type WorkBase } from "../types";
import {
  type EmployeeCreateInput,
  type EmployeeUpdateInput,
  type ReassignInput,
} from "../api/employees";

/**
 * Employee create/edit + reassign schemas (spec §7/§8; FR-HR-001, -002). The form persists
 * immediately (no draft/post lifecycle — the Employee master is not a voucher, SRS §16).
 * Every error code from API contract 12 § "Employees" maps to its exact spec §8 copy via
 * `mapEmployeeError`. Money is Decimal(18,4) throughout; dates DD/MM/YYYY in the form,
 * YYYY-MM-DD on the wire.
 */

const DECIMAL = /^\d*\.?\d*$/;
const TIN_RE = /^\d{12}$/;

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

/** `DD/MM/YYYY` → the API's `YYYY-MM-DD`. */
function uiDateToApi(value: string): string {
  const d = parseDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` (or ISO) → `DD/MM/YYYY` for the form. */
function apiDateToUi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export interface EmployeeFormValues {
  employeeCode: string;
  name: string;
  designation: string;
  defaultProjectId: string;
  department: string;
  workBase: WorkBase | "";
  wageType: WageType | "";
  wageAmount: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankName: string;
  pfApplicable: boolean;
  gratuityApplicable: boolean;
  wppfApplicable: boolean;
  tin: string;
  joiningDate: string; // DD/MM/YYYY
}

export const emptyEmployeeForm: EmployeeFormValues = {
  employeeCode: "",
  name: "",
  designation: "",
  defaultProjectId: "",
  department: "",
  workBase: "",
  wageType: "",
  wageAmount: "",
  bankAccountName: "",
  bankAccountNo: "",
  bankName: "",
  pfApplicable: false,
  gratuityApplicable: false,
  wppfApplicable: false,
  tin: "",
  joiningDate: "",
};

const dateField = (msg: string) =>
  z
    .string()
    .min(1, msg)
    .refine((v) => {
      try {
        parseDate(v);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid date (DD/MM/YYYY).");

export const employeeFormSchema = z.object({
  employeeCode: z.string().trim().min(1, "Enter an employee code."),
  name: z.string().trim().min(1, "Enter the employee's name."),
  designation: z.string(),
  defaultProjectId: z.string(),
  department: z.string(),
  workBase: z.enum(["HEAD_OFFICE", "SITE"], { message: "Select a work base." }),
  wageType: z.enum(["MONTHLY", "DAILY"], { message: "Select a wage type." }),
  wageAmount: z
    .string()
    .min(1, "Enter a wage amount of ৳0 or more.")
    .refine((v) => DECIMAL.test(v.trim()) && dec(v).greaterThanOrEqualTo(0), "Enter a wage amount of ৳0 or more."),
  bankAccountName: z.string(),
  bankAccountNo: z.string(),
  bankName: z.string(),
  pfApplicable: z.boolean(),
  gratuityApplicable: z.boolean(),
  wppfApplicable: z.boolean(),
  tin: z
    .string()
    .refine((v) => v.trim() === "" || TIN_RE.test(v.trim()), "Enter a valid TIN."),
  joiningDate: dateField("Enter a joining date."),
});

export type EmployeeFieldErrors = Partial<Record<keyof EmployeeFormValues, string>>;

/**
 * Validate the form for Save. Returns `{ values }` on success, else `{ errors }` (field map).
 * The server is authoritative — duplicate code / cross-company / immutable-code / optimistic
 * lock come back from `mapEmployeeError`.
 */
export function validateEmployee(
  form: EmployeeFormValues,
): { values: EmployeeFormValues; errors: null } | { values: null; errors: EmployeeFieldErrors } {
  const errors: EmployeeFieldErrors = {};
  const parsed = employeeFormSchema.safeParse(form);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof EmployeeFormValues | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }
  if (Object.keys(errors).length > 0) return { values: null, errors };
  return { values: form, errors: null };
}

/** Build the create body from validated form values. */
export function formToCreateInput(v: EmployeeFormValues): EmployeeCreateInput {
  return {
    employeeCode: v.employeeCode.trim(),
    name: v.name.trim(),
    designation: v.designation.trim() || null,
    defaultProjectId: v.defaultProjectId || null,
    department: v.department.trim() || null,
    workBase: v.workBase as WorkBase,
    wageType: v.wageType as WageType,
    wageAmount: dec(v.wageAmount).toFixed(4),
    bankAccountName: v.bankAccountName.trim() || null,
    bankAccountNo: v.bankAccountNo.trim() || null,
    bankName: v.bankName.trim() || null,
    pfApplicable: v.pfApplicable,
    gratuityApplicable: v.gratuityApplicable,
    wppfApplicable: v.wppfApplicable,
    tin: v.tin.trim() || null,
    joiningDate: uiDateToApi(v.joiningDate),
  };
}

/** Build the PATCH body — `employeeCode` + `joiningDate` are omitted (immutable / not editable). */
export function formToUpdateInput(v: EmployeeFormValues, version: number): EmployeeUpdateInput {
  return {
    name: v.name.trim(),
    designation: v.designation.trim() || null,
    defaultProjectId: v.defaultProjectId || null,
    department: v.department.trim() || null,
    workBase: v.workBase as WorkBase,
    wageType: v.wageType as WageType,
    wageAmount: dec(v.wageAmount).toFixed(4),
    bankAccountName: v.bankAccountName.trim() || null,
    bankAccountNo: v.bankAccountNo.trim() || null,
    bankName: v.bankName.trim() || null,
    pfApplicable: v.pfApplicable,
    gratuityApplicable: v.gratuityApplicable,
    wppfApplicable: v.wppfApplicable,
    tin: v.tin.trim() || null,
    version,
  };
}

/** Populate the form from a loaded Employee (edit pre-fill). Bank fields stay masked. */
export function employeeToForm(emp: Employee): EmployeeFormValues {
  return {
    employeeCode: emp.employeeCode,
    name: emp.name,
    designation: emp.designation ?? "",
    defaultProjectId: emp.defaultProjectId ?? "",
    department: emp.department ?? "",
    workBase: emp.workBase,
    wageType: emp.wageType,
    wageAmount: dec(emp.wageAmount).toFixed(4),
    bankAccountName: emp.bankAccountName ?? "",
    bankAccountNo: emp.bankAccountNo ?? "",
    bankName: emp.bankName ?? "",
    pfApplicable: emp.pfApplicable,
    gratuityApplicable: emp.gratuityApplicable,
    wppfApplicable: emp.wppfApplicable,
    tin: emp.tin ?? "",
    joiningDate: apiDateToUi(emp.joiningDate),
  };
}

// ── Reassign schema ───────────────────────────────────────────────────────────

export interface ReassignFormValues {
  projectId: string;
  effectiveDate: string; // DD/MM/YYYY
  note: string;
}

export const emptyReassignForm: ReassignFormValues = {
  projectId: "",
  effectiveDate: "",
  note: "",
};

export const reassignFormSchema = z.object({
  projectId: z.string().min(1, "Select a project."),
  effectiveDate: dateField("Enter an effective date."),
  note: z.string(),
});

export type ReassignFieldErrors = Partial<Record<keyof ReassignFormValues, string>>;

/**
 * Validate the reassign form. Extra rule: `effectiveDate < joiningDate` blocks with the
 * exact spec §8 copy (pre-empts a 400 VALIDATION_ERROR round-trip).
 */
export function validateReassign(
  form: ReassignFormValues,
  joiningDateIso: string,
): { values: ReassignFormValues; errors: null } | { values: null; errors: ReassignFieldErrors } {
  const errors: ReassignFieldErrors = {};
  const parsed = reassignFormSchema.safeParse(form);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ReassignFormValues | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }
  if (!errors.effectiveDate && form.effectiveDate) {
    try {
      const eff = parseDate(form.effectiveDate);
      const join = new Date(joiningDateIso);
      if (!Number.isNaN(join.getTime()) && eff.getTime() < join.getTime()) {
        errors.effectiveDate = "Effective date can't be before the joining date.";
      }
    } catch {
      // date-format error already surfaced above.
    }
  }
  if (Object.keys(errors).length > 0) return { values: null, errors };
  return { values: form, errors: null };
}

/** Build the reassign body (contract 12) from form values + optimistic version. */
export function reassignToInput(v: ReassignFormValues, version: number): ReassignInput {
  return {
    projectId: v.projectId,
    effectiveDate: uiDateToApi(v.effectiveDate),
    note: v.note.trim() || null,
    version,
  };
}

// ── Error mapping ─────────────────────────────────────────────────────────────

/**
 * Map an API error code (contract 12) to its exact spec §8 copy. `field`-scoped errors
 * surface inline at the offending control; the rest render as a top-of-form banner.
 */
export function mapEmployeeError(
  code: string,
  ctx?: { field?: keyof EmployeeFormValues },
): { field?: keyof EmployeeFormValues; message: string } {
  switch (code) {
    case "DUPLICATE_CODE":
      return { field: "employeeCode", message: "This employee code is already in use." };
    case "IMMUTABLE_EMPLOYEE_CODE":
      return { message: "This employee code can't be changed — it's already used in attendance or salary." };
    case "CROSS_COMPANY_REFERENCE":
      return { field: ctx?.field ?? "defaultProjectId", message: "That project belongs to a different company." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This employee was just changed by someone else. Reload and try again." };
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this employee. Please check the highlighted fields." };
    case "NOT_FOUND":
      return { message: "This employee could not be found." };
    case "FORBIDDEN":
      return { message: "You don't have permission to perform this action." };
    case "NETWORK_ERROR":
      return { message: "You're offline. Changes weren't saved." };
    default:
      return { message: "Something went wrong. Please try again." };
  }
}

/** Map a reassign-specific error code. */
export function mapReassignError(code: string): { field?: keyof ReassignFormValues; message: string } {
  switch (code) {
    case "VALIDATION_ERROR":
      return { field: "effectiveDate", message: "Effective date can't be before the joining date." };
    case "CROSS_COMPANY_REFERENCE":
      return { field: "projectId", message: "That project belongs to a different company." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This employee was just changed by someone else. Reload and try again." };
    case "NETWORK_ERROR":
      return { message: "You're offline. Changes weren't saved." };
    default:
      return { message: "Something went wrong. Please try again." };
  }
}

export const WAGE_TYPE_LABEL: Record<WageType, string> = {
  MONTHLY: "Monthly salary",
  DAILY: "Daily rate",
};

export const WORK_BASE_LABEL: Record<WorkBase, string> = {
  HEAD_OFFICE: "Head office",
  SITE: "Site",
};
