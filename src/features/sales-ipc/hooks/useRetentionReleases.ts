import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listRetentionReleases } from "../api/ipc-register";

/**
 * Per-IPC retention-releases audit hook (spec §5 "Retention releases list"; FR-SAL-018).
 * One hook per IPC-row expander so a single-IPC fetch failure surfaces only for that row
 * (spec §6 partial state) — the panel-level fetch is independent. `enabled` keeps the query
 * dormant until the expander opens.
 */
export function useRetentionReleases(ipcId: string, enabled: boolean) {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: ["sales-ipc", "retention-releases", user.companyId, ipcId],
    queryFn: () => listRetentionReleases(ipcId),
    enabled: enabled && !!ipcId,
  });
}
