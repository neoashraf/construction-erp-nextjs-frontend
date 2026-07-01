import { useMutation } from "@tanstack/react-query";
import { loginUser } from "../api/login";
import { type LoginInput } from "../schemas/login";

/**
 * Login mutation — calls the BFF POST /api/auth/login; sets httpOnly cookies
 * server-side; returns only the safe user. No retry: auth failures must surface
 * immediately (no silent re-attempt — that would double-count towards lockout).
 * FR-AUD-001..003, FR-AUD-008.
 */
export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => loginUser(input),
    retry: false,
  });
}
