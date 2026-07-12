import { z } from "zod";
import Decimal from "decimal.js";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type IpcWriteInput } from "../api/ipc";
import { type Ipc, type IpcStatus, type ProjectOption } from "../types";

/**
 * IPC editor schema + figure/compute/error helpers (spec §7/§8; FR-SAL-001…-014). The editor
 * captures the certificate figures and previews the live currently-due net AR + the balanced
 * ledger effect — it never asserts Σdebit=Σcredit (LED owns `PostingService`; the server is
 * authoritative). Money is `Decimal(18,4)` throughout (decimal.js, never JS float). Every
 * module error code maps to its exact spec §8 copy via `mapIpcError`.
 */

/**
 * Platform default posting rates (CLAUDE.md locked defaults: retention 10 %, advance recovery
 * 15 %; Mushak output VAT 7.5 %). These seed the OPTIMISTIC client preview on a new draft; the
 * server returns the authoritative effective rates/amounts on save/post. An existing draft's
 * rates come from its loaded resource, not these.
 */
export const IPC_DEFAULT_RATES = { vatRatePct: "7.5", retentionRatePct: "10", advanceRatePct: "15" } as const;

export const IPC_STATUSES: readonly IpcStatus[] = ["DRAFT", "POSTED", "CANCELLED"];
export const STATUS_LABEL: Record<IpcStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

/** Only a DRAFT is editable/deletable on this screen (FR-SAL-023). */
export function isEditable(status: IpcStatus): boolean {
  return status === "DRAFT";
}

const DECIMAL = /^\d*\.?\d*$/;

/** The four editable figures whose defaults derive from the certified amount / config. */
export type FigureKey = "outputVatAmount" | "aitTdsAmount" | "retentionAmount" | "advanceRecoveredAmount";

export interface IpcFormValues {
  projectId: string;
  ipcSeqNo: string;
  ipcDate: string; // DD/MM/YYYY
  billDate: string;
  dueDate: string;
  workCompletedPct: string;
  certifiedAmount: string; // Decimal string (raw, no grouping)
  costCentreId: string;
  purposeId: string;
  outputVatAmount: string;
  aitTdsAmount: string;
  retentionAmount: string;
  advanceRecoveredAmount: string;
  narration: string;
}

export const emptyIpcForm: IpcFormValues = {
  projectId: "",
  ipcSeqNo: "",
  ipcDate: "",
  billDate: "",
  dueDate: "",
  workCompletedPct: "",
  certifiedAmount: "",
  costCentreId: "",
  purposeId: "",
  outputVatAmount: "0.0000",
  aitTdsAmount: "0.0000",
  retentionAmount: "0.0000",
  advanceRecoveredAmount: "0.0000",
  narration: "",
};

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

/** The default output VAT for a certified amount (configuredVatRate × certified). */
export function defaultOutputVat(certified: string, vatRatePct: string = IPC_DEFAULT_RATES.vatRatePct): string {
  return dec(certified).times(dec(vatRatePct)).dividedBy(100).toFixed(4);
}
/** The default retention (configuredRetentionRate × certified) — overridable (FR-SAL-006). */
export function defaultRetention(certified: string, retentionRatePct: string = IPC_DEFAULT_RATES.retentionRatePct): string {
  return dec(certified).times(dec(retentionRatePct)).dividedBy(100).toFixed(4);
}
/** The default advance recovered — `min(rate × certified, remainingAdvance)`, capped (FR-SAL-008). */
export function defaultAdvanceRecovered(
  certified: string,
  remainingAdvance: string,
  advanceRatePct: string = IPC_DEFAULT_RATES.advanceRatePct,
): string {
  const uncapped = dec(certified).times(dec(advanceRatePct)).dividedBy(100);
  const cap = dec(remainingAdvance);
  return (uncapped.greaterThan(cap) ? cap : uncapped).toFixed(4);
}

/**
 * The live currently-due net AR (FR-SAL-004): `certified + outputVat − retention − advance −
 * aitTds`. An optimistic client preview, always clamped ≥ 0 for display; the raw (possibly
 * negative) value is exposed via `rawCurrentlyDue` so the editor can surface
 * `CURRENTLY_DUE_NEGATIVE` and block Save/Post.
 */
export function rawCurrentlyDue(v: Pick<IpcFormValues, FigureKey | "certifiedAmount">): Decimal {
  return dec(v.certifiedAmount)
    .plus(dec(v.outputVatAmount))
    .minus(dec(v.retentionAmount))
    .minus(dec(v.advanceRecoveredAmount))
    .minus(dec(v.aitTdsAmount));
}
export function currentlyDue(v: Pick<IpcFormValues, FigureKey | "certifiedAmount">): string {
  const raw = rawCurrentlyDue(v);
  return (raw.isNegative() ? new Decimal(0) : raw).toFixed(4);
}

/** `DD/MM/YYYY` → the API's `YYYY-MM-DD`. */
function uiDateToApi(value: string): string {
  const d = parseDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

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

const money = (msg: string) =>
  z.string().refine((v) => DECIMAL.test(v.trim()) && dec(v).greaterThanOrEqualTo(0), msg);

/** The postable-required capture fields (FR-SAL-003); figure-level rules are layered in `validateIpc`. */
export const ipcFormSchema = z
  .object({
    projectId: z.string().min(1, "Select a project."),
    ipcSeqNo: z
      .string()
      .min(1, "Enter the IPC sequence number.")
      .refine((v) => /^\d+$/.test(v.trim()) && Number(v) > 0, "Enter a whole number greater than zero."),
    ipcDate: dateField("Enter the IPC date."),
    billDate: dateField("Enter the bill date."),
    dueDate: dateField("Enter the due date."),
    workCompletedPct: z
      .string()
      .min(1, "Enter the work-completed %.")
      .refine((v) => DECIMAL.test(v.trim()), "Enter a valid percentage.")
      .refine((v) => {
        const n = dec(v);
        return n.greaterThanOrEqualTo(0) && n.lessThanOrEqualTo(100);
      }, "Work completed must be between 0 and 100."),
    certifiedAmount: z
      .string()
      .min(1, "Enter the certified amount.")
      .refine((v) => DECIMAL.test(v.trim()) && dec(v).greaterThan(0), "Certified amount must be greater than zero."),
    costCentreId: z.string().min(1, "Select a cost centre."),
    purposeId: z.string().min(1, "Select a purpose."),
    outputVatAmount: money("Output VAT can't be negative."),
    aitTdsAmount: money("AIT / TDS can't be negative."),
    retentionAmount: money("Retention can't be negative."),
    advanceRecoveredAmount: money("Advance recovered can't be negative."),
    narration: z.string().default(""),
  })
  .refine(
    (v) => {
      try {
        return parseDate(v.dueDate).getTime() >= parseDate(v.billDate).getTime();
      } catch {
        return true; // individual date errors already surfaced
      }
    },
    { path: ["dueDate"], message: "Due date can't be before the bill date." },
  );

export type FieldErrors = Partial<Record<keyof IpcFormValues, string>>;

/**
 * Validate the form for Save/Post. Returns `{ values }` on success, else `{ errors }` (field
 * map) + an optional `banner` for the non-field figure rules (currently-due-negative, advance
 * cap). `remainingAdvance` caps the advance-recovered figure (FR-SAL-008).
 */
export function validateIpc(
  form: IpcFormValues,
  remainingAdvance: string,
): { values: IpcFormValues; errors: null; banner: null } | { values: null; errors: FieldErrors; banner: string | null } {
  const errors: FieldErrors = {};
  let banner: string | null = null;

  const parsed = ipcFormSchema.safeParse(form);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof IpcFormValues | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }

  // Advance-recovered cap (FR-SAL-008) — server also caps; preview it inline.
  if (DECIMAL.test(form.advanceRecoveredAmount.trim()) && dec(form.advanceRecoveredAmount).greaterThan(dec(remainingAdvance))) {
    errors.advanceRecoveredAmount = "Advance recovered exceeds the remaining project advance.";
  }

  // Currently-due-negative (FR-SAL-004, edge case 10) — a figures-panel banner; blocks Save/Post.
  if (dec(form.certifiedAmount).greaterThan(0) && rawCurrentlyDue(form).isNegative()) {
    banner = "These figures make the currently-due amount negative. Adjust the retention, advance or taxes.";
  }

  if (Object.keys(errors).length > 0 || banner) {
    return { values: null, errors, banner };
  }
  return { values: form, errors: null, banner: null };
}

/** Build the create/patch/repost payload from validated form values. */
export function formToWriteInput(v: IpcFormValues): IpcWriteInput {
  return {
    projectId: v.projectId,
    ipcSeqNo: Number(v.ipcSeqNo),
    ipcDate: uiDateToApi(v.ipcDate),
    billDate: uiDateToApi(v.billDate),
    dueDate: uiDateToApi(v.dueDate),
    workCompletedPct: dec(v.workCompletedPct).toFixed(4),
    certifiedAmount: dec(v.certifiedAmount).toFixed(4),
    costCentreId: v.costCentreId,
    purposeId: v.purposeId,
    outputVatAmount: dec(v.outputVatAmount).toFixed(4),
    aitTdsAmount: dec(v.aitTdsAmount).toFixed(4),
    retentionAmount: dec(v.retentionAmount).toFixed(4),
    advanceRecoveredAmount: dec(v.advanceRecoveredAmount).toFixed(4),
    narration: v.narration.trim() || null,
  };
}

/** `YYYY-MM-DD` (or ISO) → `DD/MM/YYYY` for the form. */
function apiDateToUi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** Populate the form from a loaded IPC (edit / correction pre-fill). */
export function ipcToForm(ipc: Ipc): IpcFormValues {
  return {
    projectId: ipc.projectId,
    ipcSeqNo: String(ipc.ipcSeqNo),
    ipcDate: apiDateToUi(ipc.ipcDate),
    billDate: apiDateToUi(ipc.billDate),
    dueDate: apiDateToUi(ipc.dueDate),
    workCompletedPct: dec(ipc.workCompletedPct).toFixed(4),
    certifiedAmount: dec(ipc.certifiedAmount).toFixed(4),
    costCentreId: ipc.costCentreId,
    purposeId: ipc.purposeId,
    outputVatAmount: dec(ipc.outputVatAmount).toFixed(4),
    aitTdsAmount: dec(ipc.aitTdsAmount).toFixed(4),
    retentionAmount: dec(ipc.retentionAmount).toFixed(4),
    advanceRecoveredAmount: dec(ipc.advanceRecoveredAmount).toFixed(4),
    narration: ipc.narration ?? "",
  };
}

/**
 * Which figures a loaded IPC has OVERRIDDEN from their config default (so a later certified
 * edit re-defaults the untouched ones but preserves the overrides). AIT defaults to 0.
 */
export function deriveTouchedFigures(ipc: Ipc, project: ProjectOption | undefined): Set<FigureKey> {
  const touched = new Set<FigureKey>();
  const certified = dec(ipc.certifiedAmount).toFixed(4);
  const remaining = project?.remainingAdvance ?? "0.0000";
  if (dec(ipc.outputVatAmount).toFixed(4) !== defaultOutputVat(certified)) touched.add("outputVatAmount");
  if (dec(ipc.retentionAmount).toFixed(4) !== defaultRetention(certified, ipc.retentionRatePct))
    touched.add("retentionAmount");
  if (dec(ipc.advanceRecoveredAmount).toFixed(4) !== defaultAdvanceRecovered(certified, remaining, ipc.advanceRatePct))
    touched.add("advanceRecoveredAmount");
  if (!dec(ipc.aitTdsAmount).isZero()) touched.add("aitTdsAmount");
  return touched;
}

/**
 * Map a module error code (API contract 10) to its exact spec §8 copy. `field`-scoped errors
 * surface inline at the offending control; the rest render as a top-of-form / figures banner.
 */
export function mapIpcError(code: string, ctx?: { seqNo?: string }): { field?: keyof IpcFormValues; message: string } {
  switch (code) {
    case "DUPLICATE_IPC_SEQ_NO":
      return {
        field: "ipcSeqNo",
        message: ctx?.seqNo ? `This project already has IPC #${ctx.seqNo}.` : "This project already has an IPC with that number.",
      };
    case "CURRENTLY_DUE_NEGATIVE":
      return { message: "These figures make the currently-due amount negative. Adjust the retention, advance or taxes." };
    case "ADVANCE_EXCEEDS_REMAINING":
      return { field: "advanceRecoveredAmount", message: "Advance recovered exceeds the remaining project advance." };
    case "VOUCHER_POSTED_IMMUTABLE":
      return { message: "This IPC has been posted and can no longer be edited." };
    case "VOUCHER_NOT_POSTED":
      return { message: "This IPC isn't posted, so it can't be cancelled or reposted." };
    case "IPC_HAS_APPLIED_RECEIPTS":
      return { message: "A receipt has been applied to this IPC. Reverse the receipt before cancelling." };
    case "ALREADY_REVERSED":
      return { message: "This IPC has already been cancelled." };
    case "PERIOD_CLOSED":
      return { message: "The accounting period for this date is closed. Reopen it or choose another date." };
    case "NO_PERIOD_DEFINED":
      return { message: "No accounting period is defined for this date. Define one before posting." };
    case "PROJECT_CLOSED":
      return { message: "This project is closed and can't accept new IPCs." };
    case "MISSING_REQUIRED_DIMENSION":
      return { message: "A required posting dimension (project, cost centre or purpose) is missing." };
    case "MISSING_PARTY_ON_CONTROL_LINE":
      return { message: "The customer party couldn't be resolved for the receivable line." };
    case "UNBALANCED_ENTRY":
      return { message: "The ledger entry didn't balance. Please review the figures and try again." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This IPC was just changed by someone else. Reload and try again." };
    case "PROJECT_NOT_FOUND":
    case "NOT_FOUND":
      return { message: "This IPC or its project could not be found." };
    case "FORBIDDEN":
      return { message: "You don't have permission to perform this action." };
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this IPC. Please check the highlighted fields." };
    default:
      return { message: "Something went wrong. Please try again." };
  }
}
