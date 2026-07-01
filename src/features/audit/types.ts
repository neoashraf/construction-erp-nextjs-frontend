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
