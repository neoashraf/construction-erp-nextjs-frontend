import { z } from "zod";
import Decimal from "decimal.js";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type ReleaseRetentionInput } from "../api/ipc-register";

/**
 * Retention-release form schema + error mapper (spec §7/§8; FR-SAL-018…-020). The dialog
 * captures release date + optional amount + optional narration; validation enforces the
 * spec §7 `> 0` and `≤ retentionHeldAmount` bounds ahead of the server (which is
 * authoritative — a live `retentionHeldAmount` may have changed, so submit re-validates).
 * A blank amount means "release the full held amount" per FR-SAL-019.
 */

const DECIMAL = /^\d*\.?\d*$/;

export interface RetentionReleaseFormValues {
  releaseDate: string; // DD/MM/YYYY
  releasedAmount: string; // "" → full held
  narration: string;
}

export const emptyReleaseForm: RetentionReleaseFormValues = {
  releaseDate: "",
  releasedAmount: "",
  narration: "",
};

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
    }, "Enter a valid release date.");

export const releaseFormSchema = z.object({
  releaseDate: dateField("Enter a valid release date."),
  releasedAmount: z
    .string()
    .refine((v) => v.trim() === "" || DECIMAL.test(v.trim()), "Enter an amount greater than zero.")
    .refine(
      (v) => v.trim() === "" || dec(v).greaterThan(0),
      "Enter an amount greater than zero.",
    ),
  narration: z.string().default(""),
});

export type ReleaseFieldErrors = Partial<Record<keyof RetentionReleaseFormValues, string>>;

export function formatHeldOverError(retentionHeldAmount: string): string {
  return `You can't release more than the retention held (৳${retentionHeldAmount}).`;
}

/**
 * Validate the release form. Returns `{ values }` on success, else `{ errors }`. The held
 * bound is enforced live (client) AND on submit (server-authoritative); a stale panel that
 * refreshed while the dialog was open re-validates against the passed `retentionHeldAmount`.
 */
export function validateReleaseForm(
  form: RetentionReleaseFormValues,
  retentionHeldAmount: string,
): { values: RetentionReleaseFormValues; errors: null } | { values: null; errors: ReleaseFieldErrors } {
  const errors: ReleaseFieldErrors = {};
  const parsed = releaseFormSchema.safeParse(form);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof RetentionReleaseFormValues | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }

  const amtStr = form.releasedAmount.trim();
  if (amtStr !== "" && DECIMAL.test(amtStr) && dec(amtStr).greaterThan(0)) {
    if (dec(amtStr).greaterThan(dec(retentionHeldAmount))) {
      errors.releasedAmount = formatHeldOverError(retentionHeldAmount);
    }
  }

  if (Object.keys(errors).length > 0) return { values: null, errors };
  return { values: form, errors: null };
}

/** Build the API payload from validated form values. Omit `releasedAmount` when blank. */
export function formToReleaseInput(v: RetentionReleaseFormValues): ReleaseRetentionInput {
  const payload: ReleaseRetentionInput = { releaseDate: uiDateToApi(v.releaseDate) };
  const amt = v.releasedAmount.trim();
  if (amt !== "") payload.releasedAmount = dec(amt).toFixed(4);
  const nar = v.narration.trim();
  if (nar !== "") payload.narration = nar;
  return payload;
}

/**
 * Map a release-retention module error code (contract 10) to its exact spec §8 copy.
 * `field`-scoped errors surface inline; the rest render as a banner inside the dialog.
 */
export function mapReleaseError(
  code: string,
  ctx?: { retentionHeldAmount?: string },
): { field?: keyof RetentionReleaseFormValues; message: string; kind: "field" | "banner" } {
  switch (code) {
    case "OVER_RELEASE":
      return {
        field: "releasedAmount",
        message: formatHeldOverError(ctx?.retentionHeldAmount ?? "0.0000"),
        kind: "field",
      };
    case "PERIOD_CLOSED":
      return { message: "This accounting period is closed — release isn't allowed.", kind: "banner" };
    case "NO_PERIOD_DEFINED":
      return { message: "No accounting period is defined for this date. Define one before posting.", kind: "banner" };
    case "PROJECT_CLOSED":
      return { message: "This project is closed — release isn't allowed.", kind: "banner" };
    case "VOUCHER_NOT_POSTED":
      return {
        message: "This IPC isn't posted yet — retention can only be released from a posted IPC.",
        kind: "banner",
      };
    case "FORBIDDEN":
      return { message: "You don't have permission to release retention.", kind: "banner" };
    case "VALIDATION_ERROR":
      return { message: "Couldn't release retention. Please check the highlighted fields.", kind: "banner" };
    case "NOT_FOUND":
      return { message: "This IPC could not be found.", kind: "banner" };
    default:
      return { message: "Something went wrong. Please try again.", kind: "banner" };
  }
}
