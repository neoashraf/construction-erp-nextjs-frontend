import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getPayment } from "../api/payment";

/**
 * Load one payment for the editor / viewer (skill §7). Only runs when `id` is a real
 * UUID (not `"new"`); tenant/FY-scoped so a switch evicts the cache.
 */
export function usePayment(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}:${id ?? ""}`;
  return useQuery({
    queryKey: queryKeys.detail("payments", "detail", scope),
    queryFn: () => getPayment(id as string),
    enabled: !!id,
    retry: false,
  });
}
