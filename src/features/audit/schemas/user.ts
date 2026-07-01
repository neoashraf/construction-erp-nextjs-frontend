import { z } from "zod";
import { isE164 } from "@/lib/format";
import { type ApiError } from "@/lib/api/errors";
import { USER_ROLES } from "../types";

/**
 * Create / edit user form schemas (spec §7/§8; FR-AUD-002/007/011/019). Messages
 * are the exact spec §8 strings so client + server validation read alike. The
 * temporary-password policy mirrors change-password.ts (min 10 chars) — no
 * complexity/history rule is restated here beyond what the spec calls out.
 */

const EMAIL_MESSAGE = "Enter a valid email.";
const NAME_MESSAGE = "Enter the user's name.";
const ROLE_MESSAGE = "Select a role.";
const FY_MESSAGE = "Select a financial year.";
const PHONE_MESSAGE = "Enter a valid phone number, e.g. +8801XXXXXXXXX.";
const PASSWORD_MESSAGE = "Password must be at least 10 characters.";

const phoneField = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || isE164(v), PHONE_MESSAGE);

export const createUserSchema = z.object({
  email: z.string().trim().min(1, EMAIL_MESSAGE).email(EMAIL_MESSAGE),
  name: z.string().trim().min(1, NAME_MESSAGE),
  roleId: z.enum(USER_ROLES, { errorMap: () => ({ message: ROLE_MESSAGE }) }),
  financialYearId: z.string().trim().min(1, FY_MESSAGE),
  phone: phoneField,
  temporaryPassword: z.string().min(10, PASSWORD_MESSAGE),
  isActive: z.boolean().optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  name: z.string().trim().min(1, NAME_MESSAGE),
  roleId: z.enum(USER_ROLES, { errorMap: () => ({ message: ROLE_MESSAGE }) }),
  financialYearId: z.string().trim().min(1, FY_MESSAGE),
  phone: phoneField,
});

export type EditUserFormValues = z.infer<typeof editUserSchema>;

/** `POST /api/users/:id/reset-password` body — empty temp password = system-generate. */
export const resetPasswordSchema = z.object({
  temporaryPassword: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 10, PASSWORD_MESSAGE),
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

/**
 * Map a server error from `POST /api/users` or `PATCH /api/users/:id` to a field
 * error + a form-level message (spec §6/§8). `CONFLICT`/`DUPLICATE_EMAIL` both pin
 * to the email field (the API contract's canonical code is `DUPLICATE_EMAIL`; the
 * screen spec + brief describe the same case as `CONFLICT` — both are handled so
 * either backend revision maps correctly).
 */
export interface MappedUserFormError {
  fieldErrors: Partial<Record<"email" | "name" | "roleId" | "financialYearId" | "phone" | "temporaryPassword", string>>;
  formMessage?: string;
  /** True when the caller should show the reload-and-reapply conflict banner. */
  isOptimisticLockConflict?: boolean;
}

export function mapUserFormError(err: ApiError): MappedUserFormError {
  switch (err.code) {
    case "DUPLICATE_EMAIL":
    case "CONFLICT": {
      const details = (err.details ?? {}) as Record<string, unknown>;
      // A CONFLICT that isn't the email-taken case (e.g. a different uniqueness
      // rule) still needs a visible message — fall back to the form banner.
      if (details.field && details.field !== "email") {
        return { fieldErrors: {}, formMessage: err.message || "That value is already in use." };
      }
      return { fieldErrors: { email: "A user with this email already exists." } };
    }
    case "OPTIMISTIC_LOCK_CONFLICT":
      return {
        fieldErrors: {},
        formMessage:
          "This user was changed by someone else. Reload to see the latest, then reapply your changes.",
        isOptimisticLockConflict: true,
      };
    case "VALIDATION_ERROR": {
      const details = (err.details ?? {}) as Record<string, unknown>;
      const fieldErrors: MappedUserFormError["fieldErrors"] = {};
      for (const key of ["email", "name", "roleId", "financialYearId", "phone", "temporaryPassword"] as const) {
        const v = details[key];
        if (typeof v === "string") fieldErrors[key] = v;
        else if (Array.isArray(v) && typeof v[0] === "string") fieldErrors[key] = v[0];
      }
      if (Object.keys(fieldErrors).length === 0) {
        return { fieldErrors: {}, formMessage: err.message || "Check the form and try again." };
      }
      return { fieldErrors };
    }
    case "NOT_FOUND":
      return { fieldErrors: {}, formMessage: "This user no longer exists." };
    case "FORBIDDEN":
      return { fieldErrors: {}, formMessage: "You don't have permission to do that." };
    case "NETWORK_ERROR":
      return {
        fieldErrors: {},
        formMessage: "Can't reach the server. Check your connection and try again.",
      };
    default:
      return { fieldErrors: {}, formMessage: err.message || "Couldn't save this user." };
  }
}

/** Map a server error from an activate/deactivate/reset-password action to a toast message. */
export function mapUserActionError(err: ApiError): string {
  switch (err.code) {
    case "NOT_FOUND":
      return "This user no longer exists.";
    case "FORBIDDEN":
      return "You don't have permission to do that.";
    case "VALIDATION_ERROR":
      return err.message || "Password must be at least 10 characters.";
    case "NETWORK_ERROR":
      return "Can't reach the server. Check your connection and try again.";
    default:
      return err.message || "Something went wrong. Try again.";
  }
}
