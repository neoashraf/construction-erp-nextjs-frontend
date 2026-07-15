import { z } from "zod";
import { isE164 } from "@/lib/format";

/**
 * FE-52 zod + client-side avatar pre-check + server-error mapping (spec §7/§8).
 * The E.164 rule for phone matches the AUD backend use case; clearing phone
 * sends `null`. The empty-update case is a backstop — Save is *disabled* in the
 * UI until a field changes.
 */

const NAME_MAX = 120; // server allows longer; keep the UI reasonable
const PHONE_ERROR = "Enter a valid phone number, e.g. +8801712345678.";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name can't be empty.")
  .max(NAME_MAX, "Name is too long.");

/** Empty string ⇒ null (clear phone). E.164 rule when non-null. */
const phoneSchema = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === "" || isE164(v), { message: PHONE_ERROR })
  .transform((v) => (v === "" ? null : v));

export const nameFieldSchema = nameSchema;
export const phoneFieldSchema = phoneSchema;

/** Combined form input — both required in the UI, but Save is disabled until dirty. */
export interface NamePhoneFormValues {
  name: string;
  phone: string; // raw input; "" means clear
}

export interface NamePhoneErrors {
  name?: string;
  phone?: string;
}

/**
 * Validate both fields against their zod schemas. Returns per-field messages;
 * no error keys ⇒ no errors. Also returns the normalised phone (string | null).
 */
export function validateNamePhone(values: NamePhoneFormValues): {
  errors: NamePhoneErrors;
  normalisedName: string | null;
  normalisedPhone: string | null | undefined;
} {
  const errors: NamePhoneErrors = {};
  const nameResult = nameSchema.safeParse(values.name);
  const phoneResult = phoneSchema.safeParse(values.phone);
  if (!nameResult.success) errors.name = nameResult.error.errors[0]?.message;
  if (!phoneResult.success) errors.phone = phoneResult.error.errors[0]?.message;
  return {
    errors,
    normalisedName: nameResult.success ? nameResult.data : null,
    normalisedPhone: phoneResult.success ? phoneResult.data : undefined,
  };
}

// ── Avatar client pre-check (FR-AUD-039) ─────────────────────────────────────

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export type AvatarRejectReason = "TYPE" | "SIZE";

export interface AvatarPreCheckResult {
  ok: boolean;
  reason?: AvatarRejectReason;
  message?: string;
}

/** Runs BEFORE the upload fires. On reject, the existing avatar is untouched. */
export function preCheckAvatar(file: File): AvatarPreCheckResult {
  if (!(ALLOWED_MIMES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "TYPE", message: "Use a JPG, PNG, or WebP image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, reason: "SIZE", message: "Image must be 5 MB or smaller." };
  }
  return { ok: true };
}

// ── Server-error mapping (spec §8) ───────────────────────────────────────────

/** For the name/phone form. */
export function mapProfileUpdateError(code: string): string {
  switch (code) {
    case "VALIDATION_ERROR":
      return "Please check the highlighted fields and try again.";
    case "OPTIMISTIC_LOCK_CONFLICT":
      return "Your profile was updated elsewhere. We've refreshed it — please review and save again.";
    case "FORBIDDEN":
      return "You're not allowed to change these fields. Contact an admin.";
    case "NETWORK_ERROR":
      return "Can't reach the server. Check your connection and try again.";
    default:
      return "Couldn't save your profile. Try again.";
  }
}

/** For the avatar upload flow. */
export function mapAvatarUploadError(code: string): string {
  switch (code) {
    case "UNSUPPORTED_MEDIA_TYPE":
      return "Use a JPG, PNG, or WebP image.";
    case "PAYLOAD_TOO_LARGE":
      return "Image must be 5 MB or smaller.";
    case "VALIDATION_ERROR":
      return "Choose an image to upload.";
    case "MEDIA_STORAGE_ERROR":
      return "Couldn't save your photo. Try again.";
    case "NETWORK_ERROR":
      return "Can't reach the server. Check your connection and try again.";
    default:
      return "Couldn't save your photo. Try again.";
  }
}

/** For the avatar delete flow. */
export function mapAvatarDeleteError(code: string): string {
  switch (code) {
    case "MEDIA_STORAGE_ERROR":
      return "Couldn't remove your photo. Try again.";
    case "NETWORK_ERROR":
      return "Can't reach the server. Check your connection and try again.";
    default:
      return "Couldn't remove your photo. Try again.";
  }
}

/** Load-error banner text (spec §8). */
export const PROFILE_LOAD_ERROR = "Couldn't load your profile.";
export const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";
export const EMPTY_UPDATE_BACKSTOP = "Change your name or phone before saving.";
