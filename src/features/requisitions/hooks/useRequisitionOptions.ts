import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  createPurpose,
  listCostCentreOptions,
  listGodownOptions,
  listItemOptions,
  listProjectOptions,
  listPurposeOptions,
  listUserOptions,
} from "../api/masters";
import { checkBudget, getIndicativeRate, getOnHand } from "../api/requisition";
import { type BudgetStatus, type OnHand } from "../types";

/**
 * Picker-option + derived-value hooks for the entry form (skill §7). Masters change rarely
 * → a longer `staleTime`; tenant-scoped keys refetch on a company switch. Purposes/godowns
 * are project-scoped. Indicative rates + the estimated-value budget check are server-derived
 * (FR-REQ-005/CC-014); the budget check is advisory and never gates the form.
 */
const STALE = 5 * 60_000;

function useScope() {
  const user = useAuthenticatedUser();
  return { companyId: user.companyId, financialYearId: user.financialYearId };
}

export function useProjectOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("requisitions", "project-options", scope), queryFn: listProjectOptions, staleTime: STALE });
}
export function useCostCentreOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("requisitions", "cc-options", scope), queryFn: listCostCentreOptions, staleTime: STALE });
}
export function useItemOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("requisitions", "item-options", scope), queryFn: listItemOptions, staleTime: STALE });
}
export function useUserOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("requisitions", "user-options", scope), queryFn: listUserOptions, staleTime: STALE });
}
export function usePurposeOptions(projectId: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("requisitions", "purpose-options", scope, { projectId }),
    queryFn: () => listPurposeOptions(projectId),
    enabled: !!projectId,
    staleTime: STALE,
  });
}
export function useGodownOptions(projectId?: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("requisitions", "godown-options", scope, { projectId: projectId ?? "" }),
    queryFn: () => listGodownOptions(projectId),
    staleTime: STALE,
  });
}

/** Inline-create a purpose under a project (FR-CC-003); refreshes that project's options. */
export function useCreatePurpose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) => createPurpose(projectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requisitions", "purpose-options"] }),
    retry: false,
  });
}

export interface IndicativeRate {
  rate: string | null;
  isLoading: boolean;
}

/**
 * The server-derived indicative rate for each line's item at the selected godown
 * (FR-REQ-005). One query per distinct item; aligned to the input `itemIds` order. A line
 * with no item yet resolves to `{ rate: null, isLoading: false }`. While a rate loads the
 * caller shows "Calculating…"; the estimated total shows "Estimating…" until all resolve.
 */
export function useIndicativeRates(itemIds: string[], godownId: string): IndicativeRate[] {
  const scope = useScope();
  const results = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: queryKeys.list("requisitions", "indicative-rate", scope, { itemId, godownId }),
      queryFn: () => getIndicativeRate(itemId, godownId || undefined),
      enabled: !!itemId,
      staleTime: 30_000,
      retry: false,
    })),
  });
  return useMemo(
    () =>
      itemIds.map((itemId, i) => {
        if (!itemId) return { rate: null, isLoading: false };
        const r = results[i];
        return { rate: (r?.data as string | null | undefined) ?? null, isLoading: !!r?.isLoading };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemIds.join("|"), results.map((r) => `${r.isLoading}:${String(r.data)}`).join("|")],
  );
}

export interface OnHandResult {
  onHand: OnHand | null;
  isLoading: boolean;
}

/**
 * The current on-hand balance for each line's item at the selected deliver-from godown, shown at
 * draft/compose time (the design's "On-hand @ deliver" column) — advisory only here; INV enforces
 * the real guard at issue. Mirrors `useIndicativeRates` (one query per distinct item, aligned to
 * the input order). Disabled with no godown selected — on-hand is unknown until a deliver point is
 * picked, matching the mockup's implied "@ deliver" dependency.
 */
export function useOnHandBalances(itemIds: string[], godownId: string): OnHandResult[] {
  const scope = useScope();
  const results = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: queryKeys.list("requisitions", "on-hand", scope, { itemId, godownId }),
      queryFn: () => getOnHand(godownId, itemId),
      enabled: !!itemId && !!godownId,
      staleTime: 30_000,
      retry: false,
    })),
  });
  return useMemo(
    () =>
      itemIds.map((itemId, i) => {
        if (!itemId || !godownId) return { onHand: null, isLoading: false };
        const r = results[i];
        return { onHand: (r?.data as OnHand | null | undefined) ?? null, isLoading: !!r?.isLoading };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemIds.join("|"), godownId, results.map((r) => `${r.isLoading}:${String(r.data)}`).join("|")],
  );
}

/** The CC advisory budget check for the current estimate (FR-CC-014). Never blocks the form. */
export function useBudgetCheck(projectId: string, costCentreId: string, estimatedValue: string | null) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("requisitions", "budget-check", scope, { projectId, costCentreId, estimatedValue }),
    queryFn: (): Promise<BudgetStatus> =>
      checkBudget({ projectId, costCentreId, estimatedValue: estimatedValue as string }),
    enabled: !!projectId && !!costCentreId && !!estimatedValue,
    staleTime: 30_000,
    retry: false,
  });
}
