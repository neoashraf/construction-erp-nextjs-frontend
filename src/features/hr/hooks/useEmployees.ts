import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listEmployees, type EmployeeListFilter } from "../api/employees";

/**
 * Employee list hook (spec §4/§6; FR-HR-001, -003). Tenant-scoped keys;
 * `keepPreviousData` keeps the table visible (dimmed) while a filter/page reloads.
 * The Employee master is company-global — no project-scope filter here.
 */
export function useEmployees(filter: EmployeeListFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("hr", "employees", scope, filter as Record<string, unknown>),
    queryFn: () => listEmployees(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}
