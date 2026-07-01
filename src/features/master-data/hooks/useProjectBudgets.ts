import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBudgets, upsertBudget, removeBudget } from "../api/project-budgets";

export const BUDGETS_KEY = ["master-data", "project-budgets"] as const;

export function useProjectBudgets(projectId: string | null) {
  return useQuery({
    queryKey: [...BUDGETS_KEY, projectId],
    queryFn: () => listBudgets(projectId!),
    enabled: !!projectId,
  });
}

function useInvalidate(projectId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...BUDGETS_KEY, projectId] });
}

export function useUpsertBudget(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (input: { costCentreId: string; budgetedAmount: string; version?: number }) =>
      upsertBudget(projectId, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useRemoveBudget(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (id: string) => removeBudget(projectId, id),
    onSuccess: invalidate,
    retry: false,
  });
}
