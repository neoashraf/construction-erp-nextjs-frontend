import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getMatch } from "../api/match";

/**
 * Read-only PO → Bill → GRN match view (contract 08 GET /orders/{id}/match;
 * FR-PUR-017/-018). `retry:false` so 403/404 surface at once — the match screen
 * renders permission-denied / not-found.
 */
export function useMatch(poId: string | null) {
  return useQuery({
    queryKey: queryKeys.detail("purchase", "match", poId ?? ""),
    queryFn: () => getMatch(poId as string),
    enabled: !!poId,
    retry: false,
  });
}
