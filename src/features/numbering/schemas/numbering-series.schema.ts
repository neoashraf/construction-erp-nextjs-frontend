import { z } from "zod";
import { type ApiError } from "@/lib/api/errors";

/**
 * Series-editor form schema (spec §7/§8; FR-NUM-002, FR-NUM-013, FR-NUM-018). Only
 * `prefix` and `paddingWidth` are editable — everything else is read-only context.
 * Messages are the exact spec §8 strings so client + server validation read alike.
 */

/** Safe document-reference charset: letters, digits, `-`, `_`. No `/` (breaks the format). */
const PREFIX_CHARSET = /^[A-Za-z0-9_-]+$/;

export const seriesEditSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, "Enter a prefix.")
    .regex(PREFIX_CHARSET, "Use only letters, digits and - _ — no /."),
  // Coerce from the numeric stepper / input; integer ≥ 1 (default 4 lives in the UI).
  paddingWidth: z.coerce
    .number({ invalid_type_error: "Padding width must be at least 1." })
    .int("Padding width must be at least 1.")
    .min(1, "Padding width must be at least 1."),
});

export type SeriesEditFormValues = z.infer<typeof seriesEditSchema>;

/**
 * Compose the sample number `<prefix>/<FY label>/<zeroPad(seq, width)>` for the
 * live editor preview (FR-NUM-013). The FY-label segment is taken from an existing
 * server-composed `nextNumberPreview` (its middle `/`-segment) so the UI renders
 * **whatever MAS supplies** and never hard-codes the label form (spec §12, §14).
 * Numbers longer than the padding width render at FULL length — never clipped
 * (SRS §11, Edge Case 8).
 */
export function zeroPad(seq: number, width: number): string {
  const s = String(Math.max(0, Math.trunc(seq)));
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

/** Extract the FY-label segment (`2526`) from a server-composed preview, if present. */
export function fyLabelFromPreview(preview: string | undefined): string {
  const parts = (preview ?? "").split("/");
  return parts.length >= 3 ? (parts[parts.length - 2] ?? "") : "";
}

export function composePreview(
  prefix: string,
  paddingWidth: number,
  nextSequence: number,
  fyLabel: string,
): string {
  const seg = zeroPad(nextSequence, Number.isFinite(paddingWidth) ? paddingWidth : 0);
  return fyLabel ? `${prefix}/${fyLabel}/${seg}` : `${prefix}/${seg}`;
}

/**
 * Map a server error from `PATCH …/{id}` to a field error + a form-level message
 * (spec §8). `VALIDATION_ERROR` may carry `details` naming the offending field;
 * `IMMUTABLE_FIELD` means an attempt to change the key/lastSequence (FR-NUM-018).
 */
export interface MappedServerError {
  /** Field-scoped message keyed by form field, when the error pins to one. */
  fieldErrors: Partial<Record<keyof SeriesEditFormValues, string>>;
  /** A banner/toast message when the error isn't field-scoped. */
  formMessage?: string;
}

export function mapSeriesEditError(err: ApiError): MappedServerError {
  switch (err.code) {
    case "VALIDATION_ERROR": {
      const details = (err.details ?? {}) as Record<string, unknown>;
      const fieldErrors: MappedServerError["fieldErrors"] = {};
      if (typeof details.prefix === "string") fieldErrors.prefix = details.prefix;
      if (typeof details.paddingWidth === "string")
        fieldErrors.paddingWidth = details.paddingWidth;
      if (Object.keys(fieldErrors).length === 0) {
        // No per-field detail — surface a sensible default on the likely field.
        fieldErrors.prefix = "Use only letters, digits and - _ — no /.";
      }
      return { fieldErrors };
    }
    case "IMMUTABLE_FIELD":
    case "CONFLICT":
      return {
        fieldErrors: {},
        formMessage:
          "Last sequence can't be edited — it advances only when a voucher posts.",
      };
    case "SERIES_NOT_FOUND":
    case "NOT_FOUND":
      return {
        fieldErrors: {},
        formMessage: "This series no longer exists. Refresh the list.",
      };
    case "SERIES_ALREADY_EXISTS":
      return {
        fieldErrors: {},
        formMessage:
          "A series for this voucher type already exists for this company and financial year.",
      };
    case "CROSS_COMPANY_REFERENCE":
      return {
        fieldErrors: {},
        formMessage: "That financial year doesn't belong to this company.",
      };
    case "FORBIDDEN":
      return { fieldErrors: {}, formMessage: "You don't have permission to do that." };
    case "NETWORK_ERROR":
      return { fieldErrors: {}, formMessage: "You're offline. Changes weren't saved." };
    default:
      return { fieldErrors: {}, formMessage: err.message || "Couldn't save the numbering series." };
  }
}
