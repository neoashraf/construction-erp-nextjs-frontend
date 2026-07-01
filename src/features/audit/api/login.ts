import { apiClient } from "@/lib/api/client";
import { type LoginInput } from "../schemas/login";
import { type LoginSessionUser } from "../types";

export interface LoginResponse {
  user: LoginSessionUser;
}

/**
 * POST /api/auth/login (BFF) — credentials go in; BFF sets httpOnly cookies
 * and returns only the safe user object (no tokens). FR-AUD-001..003, FR-AUD-008.
 */
export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>("/auth/login", input);
}
