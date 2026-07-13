import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getCompanyProfile, getPartyProfile } from "../api/mushak-refs";

/**
 * Company + customer party reads for the Mushak 6.3 print preview (brief §5.7, FR-SAL-024).
 * Cached longer than the IPC/ledger reads — company + party identifiers change rarely.
 * `retry:false` so a `403` (unlikely for the caller's own company) or `404` surfaces at
 * once as the print's partial state ("Not on file"), not a hang. Never fabricates a
 * missing BIN/TIN — the preview shows "Not on file" on-screen and simply omits the field
 * on the (RPT-owned) PDF when it lands (Open items 2/3; brief G2).
 */
const STALE = 5 * 60_000;

export function useMushakRefs(customerId: string | null) {
  const user = useAuthenticatedUser();

  const company = useQuery({
    queryKey: queryKeys.detail("sales-ipc", "mushak-company", user.companyId),
    queryFn: () => getCompanyProfile(user.companyId),
    enabled: !!user.companyId,
    staleTime: STALE,
    retry: false,
  });

  const party = useQuery({
    queryKey: queryKeys.detail("sales-ipc", "mushak-party", customerId ?? ""),
    queryFn: () => getPartyProfile(customerId as string),
    enabled: !!customerId,
    staleTime: STALE,
    retry: false,
  });

  return { company, party };
}
