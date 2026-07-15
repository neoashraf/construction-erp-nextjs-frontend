import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listOpenPayables, type OpenPayablesFilter } from "../api/payment";

/**
 * Open-payables read for the Outstanding view (contract 13 `GET /api/payment/open-payables`).
 * `remainingOutstanding = originalAmount − appliedAmount` is a live query over
 * `payment_allocation` — never a stored balance (FR-PAY-007/-017).
 */
export function useOpenPayables(filter: OpenPayablesFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("payments", "open-payables", scope, { ...filter }),
    queryFn: () => listOpenPayables(filter),
    retry: false,
  });
}
