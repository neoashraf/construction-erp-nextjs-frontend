import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getProfile } from "../api/profile";

/**
 * FE-52 — read the caller's own profile (self-scoped from the token; no `:id`).
 * The cache key is not tenant-scoped because the profile itself belongs to the
 * user, not the tenant — same user identity across an FY switch.
 */
export function useProfileRead() {
  return useQuery({
    queryKey: queryKeys.detail("profile", "self", "me"),
    queryFn: getProfile,
    retry: false,
  });
}
