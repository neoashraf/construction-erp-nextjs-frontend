import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { updateProfile } from "../api/profile";
import { type ProfileUpdate, type ProfileView } from "../types";

/**
 * FE-52 — PATCH /api/profile with `{ name?, phone?, version }`. On success we
 * seed the cache with the refreshed profile so the screen re-renders from the
 * bumped `version` immediately, no re-fetch needed. The caller is responsible
 * for refreshing the session read (`GET /api/auth/me`) so the popover/header
 * pick up the new name (Open item 2).
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => updateProfile(body),
    onSuccess: (fresh: ProfileView) => {
      qc.setQueryData(queryKeys.detail("profile", "self", "me"), fresh);
    },
  });
}
