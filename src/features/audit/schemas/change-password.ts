import { z } from "zod";

/**
 * Client mirror of the SRS §16 / API password policy (min 10 chars + letters &
 * numbers). Advisory/gating only — the server is authoritative and may still
 * reject (VALIDATION_ERROR mapped back onto the new-password field). No
 * password-reuse/history rule (SRS §16 — do not add one here).
 */
export const PASSWORD_MIN_LENGTH = 10;

export function hasMinLength(pw: string): boolean {
  return pw.length >= PASSWORD_MIN_LENGTH;
}

export function hasLetterAndNumber(pw: string): boolean {
  return /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Password must be at least 10 characters.")
      .refine(hasLetterAndNumber, "Password must include letters and numbers."),
    confirmPassword: z.string().min(1, "Passwords don't match."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The request body actually sent to the API — confirm is client-only, never sent. */
export type ChangePasswordRequest = Pick<ChangePasswordInput, "currentPassword" | "newPassword">;
