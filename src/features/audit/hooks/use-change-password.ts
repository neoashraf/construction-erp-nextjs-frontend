import { useMutation } from "@tanstack/react-query";
import { changePassword } from "../api/change-password";
import { type ChangePasswordRequest } from "../schemas/change-password";

/**
 * Change-password mutation (FR-AUD-006/002). No retry: a failed attempt must
 * surface immediately (current-password-wrong or policy-fail), never silently
 * re-fire. Success means the caller's refresh tokens are already revoked
 * server-side, so the caller must force sign-out — see ChangePasswordCard.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordRequest) => changePassword(input),
    retry: false,
  });
}
