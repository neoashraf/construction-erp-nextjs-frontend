import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listIpcs, type IpcListFilter } from "../api/ipc";

/**
 * IPC list hook (skill §7; FR-SAL-015/-016). Tenant-scoped keys; `keepPreviousData` keeps the
 * table visible (dimmed) while a filter/page reloads. The server scopes a Project Manager to
 * assigned projects (unassigned rows excluded silently).
 */
export function useIpcList(filter: IpcListFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("sales-ipc", "ipc", scope, filter as Record<string, unknown>),
    queryFn: () => listIpcs(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}
