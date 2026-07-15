import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getJournalVoucher } from "../api/journal";

export function useJournalVoucher(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}:${id ?? ""}`;
  return useQuery({
    queryKey: queryKeys.detail("contra-journal", "journal", scope),
    queryFn: () => getJournalVoucher(id as string),
    enabled: !!id,
    retry: false,
  });
}
