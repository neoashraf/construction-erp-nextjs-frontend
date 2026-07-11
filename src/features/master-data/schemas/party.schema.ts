import { z } from "zod";
import { toBangladeshE164 } from "@/lib/format";
import { isNonNegativeMoney, parseMoney } from "@/lib/money";

/**
 * Create/edit party form (spec §7; FR-MAS-023). Name required; at least one role
 * (customer/supplier) required as a group; phone required E.164 (+880); TIN 12
 * digits / BIN 13 digits (NBR, SRS §16); email format; payment-terms days ≥ 0;
 * opening balance ≥ 0.
 * Values are strings in the form; converted on submit.
 */

// Must match the backend value objects exactly: TIN is 12 digits, BIN is 13
// digits (NBR). Keeping these looser than the server let bad input pass client
// validation and fail on POST.
const TIN_RE = /^\d{12}$/;
const BIN_RE = /^\d{13}$/;

function normalizablePhone(v: string): boolean {
  try {
    toBangladeshE164(v);
    return true;
  } catch {
    return false;
  }
}

function optionalFormat(re: RegExp, message: string) {
  return z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || re.test(v), message);
}

export const partySchema = z
  .object({
    name: z.string().trim().min(1, "Party name is required."),
    isCustomer: z.boolean(),
    isSupplier: z.boolean(),
    tin: optionalFormat(TIN_RE, "TIN must be exactly 12 digits."),
    bin: optionalFormat(BIN_RE, "BIN must be exactly 13 digits."),
    address: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim()),
    phone: z
      .string()
      .trim()
      .min(1, "Enter a valid phone number in +880 format.")
      .refine(normalizablePhone, "Enter a valid phone number in +880 format."),
    email: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim())
      .refine(
        (v) => v === "" || z.string().email().safeParse(v).success,
        "Enter a valid email address.",
      ),
    paymentTermsDays: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim())
      .refine((v) => v === "" || /^\d+$/.test(v), "Enter 0 or more days."),
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
  })
  .superRefine((val, ctx) => {
    if (!val.isCustomer && !val.isSupplier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: "Select at least one role (customer or supplier).",
      });
    }
  });

export type PartyFormValues = z.infer<typeof partySchema>;
