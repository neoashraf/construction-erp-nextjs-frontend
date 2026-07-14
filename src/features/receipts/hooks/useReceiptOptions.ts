import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listCustomerOptions, listProjectOptions } from "../api/masters";
import { listIpcOptions } from "../api/sales";

/** Picker-option hooks for the filter bar (nextjs-author skill §7). Masters change
 * rarely — a longer `staleTime`; tenant-scoped keys refetch on a company switch. */
const STALE = 5 * 60_000;

function useScope() {
  const user = useAuthenticatedUser();
  return { companyId: user.companyId, financialYearId: user.financialYearId };
}

export function useProjectOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("receipts", "project-options", scope),
    queryFn: listProjectOptions,
    staleTime: STALE,
  });
}

export function useCustomerOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("receipts", "customer-options", scope),
    queryFn: listCustomerOptions,
    staleTime: STALE,
  });
}

/** IPC label resolution (`entryNo`) for the list's IPC column + the deep-link chip. */
export function useIpcOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("receipts", "ipc-options", scope),
    queryFn: listIpcOptions,
    staleTime: STALE,
  });
}
