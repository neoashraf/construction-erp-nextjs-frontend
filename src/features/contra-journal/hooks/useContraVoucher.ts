import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getContraVoucher } from "../api/contra";

export function useContraVoucher(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}:${id ?? ""}`;
  return useQuery({
    queryKey: queryKeys.detail("contra-journal", "contra", scope),
    queryFn: () => getContraVoucher(id as string),
    enabled: !!id,
    retry: false,
  });
}
