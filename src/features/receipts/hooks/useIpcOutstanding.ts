import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getReceiptsForIpc } from "../api/receipt";

/**
 * The referenced IPC's currently-due + total-applied + balance-due (contract 11
 * `GET /api/receipt/ipc/{ipcId}`). The editor uses `balanceDue` as the base for the live
 * balance-due-after preview + over-application client pre-check (FR-REC-017, FR-REC-018).
 * Server re-checks at Post regardless.
 */
export function useIpcOutstanding(ipcId: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}:${ipcId ?? ""}`;
  return useQuery({
    queryKey: queryKeys.detail("receipts", "ipc-outstanding", scope),
    queryFn: () => getReceiptsForIpc(ipcId as string),
    enabled: !!ipcId,
    retry: false,
  });
}
