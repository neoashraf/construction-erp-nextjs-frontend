import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { deleteAvatar, uploadAvatar } from "../api/profile";
import { type ProfileView } from "../types";

/**
 * FE-52 — POST/DELETE the avatar. Both mutations reseed the cache from the
 * server-refreshed ProfileView (avatarUrl becomes real on upload success,
 * `null` on delete success). Client-side pre-check runs BEFORE these hooks fire.
 */
export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (fresh: ProfileView) => {
      qc.setQueryData(queryKeys.detail("profile", "self", "me"), fresh);
    },
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAvatar(),
    onSuccess: (fresh: ProfileView) => {
      qc.setQueryData(queryKeys.detail("profile", "self", "me"), fresh);
    },
  });
}
