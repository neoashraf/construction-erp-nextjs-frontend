import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getReceipt } from "../api/receipt";

/**
 * Load one receipt for the editor (spec §6 — edit-existing-draft entry). Only runs when
 * `id` is a real UUID (not `"new"`); scoped to the current company/FY so a tenant switch
 * evicts the cache.
 */
export function useReceipt(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}:${id ?? ""}`;
  return useQuery({
    queryKey: queryKeys.detail("receipts", "detail", scope),
    queryFn: () => getReceipt(id as string),
    enabled: !!id,
    retry: false,
  });
}
