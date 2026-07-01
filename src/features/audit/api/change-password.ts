import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type ChangePasswordRequest } from "../schemas/change-password";

/**
 * POST /api/auth/change-password (via the BFF proxy — API contract 05).
 * Request `{ currentPassword, newPassword }`; confirm is client-only and never
 * sent. `204` on success — the backend re-hashes and revokes ALL the caller's
 * refresh tokens, so the BFF/UI must force sign-out afterwards (FR-AUD-006/002).
 * State-changing → CSRF double-submit token required.
 */
export async function changePassword(input: ChangePasswordRequest): Promise<void> {
  await apiClient.post<void>("/auth/change-password", input, { csrfToken: readCsrfToken() });
}
