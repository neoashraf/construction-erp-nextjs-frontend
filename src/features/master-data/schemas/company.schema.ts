import { z } from "zod";

/**
 * Company identity + localization forms (spec §7; FR-MAS-004). Company name is
 * required; BIN/TIN are optional and format-only (SRS §16) — validated only when
 * present. Localization selects are all required (Phase-1: BDT / DD/MM/YYYY / bn-BD).
 */

const BIN_RE = /^\d{9,13}$/;
const TIN_RE = /^\d{10,12}$/;

/** Optional field that, when non-empty, must match `re`; empty/undefined passes. */
function optionalFormat(re: RegExp, message: string) {
  return z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || re.test(v), message);
}

export const companyIdentitySchema = z.object({
  name: z.string().trim().min(1, "Company name is required."),
  legalName: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
  bin: optionalFormat(BIN_RE, "Enter a valid BIN."),
  tin: optionalFormat(TIN_RE, "Enter a valid TIN."),
  address: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
});

export type CompanyIdentityValues = z.infer<typeof companyIdentitySchema>;

export const localizationSchema = z.object({
  currency: z.string().min(1, "Select a currency."),
  dateFormat: z.string().min(1, "Select a date format."),
  locale: z.string().min(1, "Select a locale."),
});

export type LocalizationValues = z.infer<typeof localizationSchema>;

/** Select option sets (Phase-1). */
export const CURRENCY_OPTIONS = [{ value: "BDT", label: "BDT — Bangladeshi Taka" }];
export const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];
export const LOCALE_OPTIONS = [
  { value: "bn-BD", label: "bn-BD — Bengali (Bangladesh)" },
  { value: "en-US", label: "en-US — English (United States)" },
];
