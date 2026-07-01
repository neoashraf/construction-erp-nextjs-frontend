import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listCostCentres,
  createCostCentre,
  renameCostCentre,
  deactivateCostCentre,
  reactivateCostCentre,
  type CostCentreFilter,
} from "../api/cost-centres";

export const COST_CENTRES_KEY = ["master-data", "cost-centres"] as const;

export function useCostCentres(filter: CostCentreFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list(
      "master-data",
      "cost-centres",
      scope,
      filter as Record<string, unknown>,
    ),
    queryFn: () => listCostCentres(filter),
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COST_CENTRES_KEY });
}

export function useCreateCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (i: { code: string; name: string }) => createCostCentre(i),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useRenameCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name: string; version: number } }) =>
      renameCostCentre(id, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useDeactivateCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deactivateCostCentre(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useReactivateCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      reactivateCostCentre(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}
