import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getOnHand, listRequisitionIssues } from "../api/requisition";
import { type OnHand } from "../types";

/**
 * Issue-history read (`GET /:id/issues`; FR-REQ-013…-019). Powers the status trail's issue
 * events + their reversal markers. Refetched after each issue/reverse. `retry:false` so a
 * `403`/`404` surfaces at once.
 */
export function useRequisitionIssues(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("requisitions", "issues", id ?? ""),
    queryFn: () => listRequisitionIssues(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}

export interface OnHandResult {
  onHand: OnHand | null;
  isLoading: boolean;
}

/**
 * The current on-hand for each issue line's `(godown, item)` (FR-REQ-016) — one query per
 * distinct pair, aligned to the input order. While a read is in flight the line shows
 * "Checking stock…" and disables its quantity input (spec §6 partial). A pair with no godown
 * yet resolves to `{ onHand: null, isLoading: false }`. Read from the INV projection (REQ-local
 * binding, import-boundary safe).
 */
export function useOnHandBalances(
  pairs: Array<{ godownId: string; itemId: string }>,
): OnHandResult[] {
  const scope = useScope();
  const results = useQueries({
    queries: pairs.map(({ godownId, itemId }) => ({
      queryKey: queryKeys.list("requisitions", "on-hand", scope, { godownId, itemId }),
      queryFn: () => getOnHand(godownId, itemId),
      enabled: !!godownId && !!itemId,
      staleTime: 15_000,
      retry: false,
    })),
  });
  const pairsKey = pairs.map((p) => `${p.godownId}:${p.itemId}`).join("|");
  const resultsKey = results
    .map((r) => `${r.isLoading}:${String(r.data && (r.data as OnHand).quantityOnHand)}`)
    .join("|");
  return useMemo(
    () =>
      pairs.map(({ godownId, itemId }, i) => {
        if (!godownId || !itemId) return { onHand: null, isLoading: false };
        const r = results[i];
        return {
          onHand: (r?.data as OnHand | null | undefined) ?? null,
          isLoading: !!r?.isLoading,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairsKey, resultsKey],
  );
}

function useScope() {
  const user = useAuthenticatedUser();
  return { companyId: user.companyId, financialYearId: user.financialYearId };
}
