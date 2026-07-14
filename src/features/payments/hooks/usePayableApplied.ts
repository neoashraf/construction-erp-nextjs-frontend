import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getPayableApplied } from "../api/payment";
import { type PayableType } from "../types";

/**
 * The per-payable applied-payments trail (contract 13 `…/payables/{type}/{id}/applied`).
 * Fires only once both `payableType` and `payableId` are set — the drill-in opens.
 * Cancelled payments drop out, so `remainingOutstanding` rises back automatically.
 */
export function usePayableApplied(payableType: PayableType | null, payableId: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}`;
  const key = `${scope}:${payableType ?? ""}:${payableId ?? ""}`;
  return useQuery({
    queryKey: queryKeys.detail("payments", "payable-applied", key),
    queryFn: () => getPayableApplied(payableType as PayableType, payableId as string),
    enabled: !!payableType && !!payableId,
    retry: false,
  });
}
