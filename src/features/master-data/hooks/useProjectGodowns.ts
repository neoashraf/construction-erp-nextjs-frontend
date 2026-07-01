import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listGodowns,
  createGodown,
  updateGodown,
  deactivateGodown,
  reactivateGodown,
} from "../api/project-godowns";

export const GODOWNS_KEY = ["master-data", "godowns"] as const;

export function useProjectGodowns(projectId: string | null) {
  return useQuery({
    queryKey: [...GODOWNS_KEY, projectId],
    queryFn: () => listGodowns(projectId!),
    enabled: !!projectId,
  });
}

function useInvalidate(projectId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...GODOWNS_KEY, projectId] });
}

export function useCreateGodown(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (input: { name: string; location?: string | null }) =>
      createGodown({ projectId, ...input }),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useUpdateGodown(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { name?: string; location?: string | null; version: number };
    }) => updateGodown(id, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useDeactivateGodown(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deactivateGodown(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useReactivateGodown(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => reactivateGodown(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}
