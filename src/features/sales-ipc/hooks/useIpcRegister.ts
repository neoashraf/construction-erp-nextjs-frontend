import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getIpcRegister } from "../api/ipc-register";

/**
 * IPC register hook (spec §5/§6; FR-SAL-015/-016). Tenant + FY-scoped keys; a project or FY
 * change re-fetches both this hook AND the retention releases together (§9 "shared project
 * scope"). PM readers are scoped to assigned projects server-side (`403` on an unassigned).
 */
export function useIpcRegister(projectId: string, financialYearId?: string, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("sales-ipc", "register", scope, { projectId, fy: financialYearId ?? null }),
    queryFn: () => getIpcRegister(projectId, financialYearId),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
  });
}
