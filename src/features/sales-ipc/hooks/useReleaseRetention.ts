import { useMutation, useQueryClient } from "@tanstack/react-query";
import { releaseRetention, type ReleaseRetentionInput } from "../api/ipc-register";

/**
 * Retention-release mutation (FR-SAL-018…-020). Server-confirmed, non-idempotent — no
 * optimistic update. On success invalidates the project's register (so per-IPC outstanding
 * refreshes) and this IPC's releases list (so the audit expander refreshes); the panel's
 * held/released headline recomputes as part of the register refetch.
 */
export function useReleaseRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ipcId, input }: { ipcId: string; input: ReleaseRetentionInput }) =>
      releaseRetention(ipcId, input),
    onSuccess: async (_data, { ipcId }) => {
      // Invalidate + force an active refetch so the panel headline (held/released) + the
      // register row (outstanding) reconcile to server state before the next interaction.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sales-ipc", "register"], refetchType: "active" }),
        qc.invalidateQueries({ queryKey: ["sales-ipc", "retention-releases"] }),
        qc.invalidateQueries({ queryKey: ["sales-ipc", "ipc", "detail", ipcId] }),
      ]);
    },
    retry: false,
  });
}
