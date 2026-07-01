/**
 * View-model types for the Audit, Security & Access (AUD) feature (skill §2.1).
 * These are UI-facing types — NOT the generated wire types in lib/api/generated.
 */

/** Variant for the auth error banner (login screen). */
export type AuthBannerVariant = "auth" | "session" | "offline";

/** Safe user fields returned by the BFF login endpoint (no token fields). */
export interface LoginSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  financialYearId: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

/**
 * Variant for the change-password screen's banner (spec §6/§8). "forced" is the
 * blue "required" status banner shown in forced-change mode; "success"/"offline"
 * are the post-submit outcome banners.
 */
export type ChangePasswordBannerVariant = "forced" | "success" | "offline";

/** Live password-strength estimate for the new-password field (spec §5, advisory only). */
export interface PasswordStrength {
  /** 0 = empty, 1..4 = weak..strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "—" | "Weak" | "Fair" | "Good" | "Strong";
}

/** One row of the live policy checklist (spec §5/§6 — SRS §16: min 10 + complexity). */
export interface PolicyChecklistItem {
  id: "length" | "complexity";
  label: string;
  met: boolean;
}
