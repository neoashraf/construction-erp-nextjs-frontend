import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listNumberingSeries,
  updateNumberingSeries,
  getNextPreview,
  getGapAudit,
} from "../api/numbering-series";
import { type SeriesEditInput } from "../types";

/**
 * NUM series hooks (skill §7). Keys are namespaced + tenant/FY-scoped so a company /
 * FY switch doesn't bleed cache. The mutation is server-confirmed (no optimistic UI,
 * spec §9); on success we invalidate the list so the row's `nextNumberPreview`
 * refreshes. Preview + gap-audit are on-demand (enabled) reads.
 */

export const NUMBERING_SERIES_KEY = ["numbering", "series"] as const;

/** List series for the active company + FY (from the session). */
export function useNumberingSeries() {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("numbering", "series", scope),
    queryFn: () =>
      listNumberingSeries({
        companyId: user.companyId,
        financialYearId: user.financialYearId,
      }),
    placeholderData: keepPreviousData,
  });
}

/** Forward-only edit of prefix / paddingWidth (FR-NUM-002/020). Invalidates the list. */
export function useUpdateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SeriesEditInput }) =>
      updateNumberingSeries(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: NUMBERING_SERIES_KEY }),
    retry: false,
  });
}

/**
 * Non-consuming next-number preview for one series (FR-NUM-013). Off until `enabled`
 * so it only fires when a row/editor asks for a fresh sample.
 */
export function useNextPreview(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["numbering", "series", "next-preview", id],
    queryFn: () => getNextPreview(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}

/**
 * Read-only continuity report for one series (FR-NUM-021). Off until `enabled`
 * (opened panel / "Run gap audit"); `asOf` bounds it. Never blocks posts (API note).
 */
export function useGapAudit(id: string | null, asOf: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["numbering", "series", "gap-audit", id, asOf ?? null],
    queryFn: () => getGapAudit(id as string, asOf),
    enabled: enabled && !!id,
    retry: false,
  });
}
