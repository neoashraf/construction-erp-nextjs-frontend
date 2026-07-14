import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listAccountOptions,
  listCostCentreOptions,
  listCustomerOptions,
  listProjectOptions,
  listPurposeOptions,
} from "../api/masters";
import { getIpcDetail, listPostedIpcsForCustomer } from "../api/sales";

/**
 * Read-only picker options for the Receipt editor (spec §5). Each list is
 * tenant/FY-scoped so a company/FY switch evicts the cache; a `staleTime` keeps
 * the same list cached briefly across screens. Purposes are project-scoped and
 * only fire when a project is chosen (§B). Posted IPCs are customer-scoped and
 * only fire once a customer is chosen (§A).
 */

function useTenant() {
  const user = useAuthenticatedUser();
  return `${user.companyId}:${user.financialYearId}`;
}

const OPTIONS_STALE_MS = 60_000;

export function useAccountOptions() {
  const tenant = useTenant();
  return useQuery({
    queryKey: queryKeys.list("receipts", "accounts", { companyId: tenant, financialYearId: tenant }, {}),
    queryFn: () => listAccountOptions(),
    staleTime: OPTIONS_STALE_MS,
  });
}

export function useProjectOptions() {
  const tenant = useTenant();
  return useQuery({
    queryKey: queryKeys.list("receipts", "projects", { companyId: tenant, financialYearId: tenant }, {}),
    queryFn: () => listProjectOptions(),
    staleTime: OPTIONS_STALE_MS,
  });
}

export function useCustomerOptions() {
  const tenant = useTenant();
  return useQuery({
    queryKey: queryKeys.list("receipts", "customers", { companyId: tenant, financialYearId: tenant }, {}),
    queryFn: () => listCustomerOptions(),
    staleTime: OPTIONS_STALE_MS,
  });
}

export function useCostCentreOptions() {
  const tenant = useTenant();
  return useQuery({
    queryKey: queryKeys.list("receipts", "cost-centres", { companyId: tenant, financialYearId: tenant }, {}),
    queryFn: () => listCostCentreOptions(),
    staleTime: OPTIONS_STALE_MS,
  });
}

export function usePurposeOptions(projectId: string) {
  const tenant = useTenant();
  return useQuery({
    queryKey: queryKeys.list("receipts", "purposes", { companyId: tenant, financialYearId: tenant }, { projectId }),
    queryFn: () => listPurposeOptions(projectId),
    enabled: !!projectId,
    staleTime: OPTIONS_STALE_MS,
  });
}

/**
 * Posted IPCs for a chosen customer (§A picker). Empty-array result flags the
 * "No posted IPCs for this customer." empty state.
 */
export function usePostedIpcsForCustomer(customerId: string) {
  const tenant = useTenant();
  return useQuery({
    queryKey: queryKeys.list("receipts", "posted-ipcs", { companyId: tenant, financialYearId: tenant }, { customerId }),
    queryFn: () => listPostedIpcsForCustomer(customerId),
    enabled: !!customerId,
    staleTime: OPTIONS_STALE_MS,
  });
}

/** The picked IPC's full detail — used to render the read-only inherited-dimensions chips. */
export function useIpcDetail(ipcId: string) {
  const tenant = useTenant();
  return useQuery({
    queryKey: queryKeys.detail("receipts", "ipc-detail", `${tenant}:${ipcId}`),
    queryFn: () => getIpcDetail(ipcId),
    enabled: !!ipcId,
    staleTime: OPTIONS_STALE_MS,
  });
}
