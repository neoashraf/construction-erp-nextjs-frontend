import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listRequisitions, type RequisitionListFilter } from "../api/requisition";

/**
 * Requisition list hook (skill §7; FR-REQ-021/-022). Tenant-scoped keys; `keepPreviousData`
 * keeps the table visible (dimmed) while a filter/page reloads. The server scopes
 * PM/Site Engineer/Store Keeper to assigned projects.
 */
export const REQUISITIONS_KEY = ["requisitions", "requisition"] as const;

export function useRequisitions(filter: RequisitionListFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("requisitions", "requisition", scope, filter as Record<string, unknown>),
    queryFn: () => listRequisitions(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}
