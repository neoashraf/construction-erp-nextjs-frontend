import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listPurposes,
  createPurpose,
  renamePurpose,
  deactivatePurpose,
  reactivatePurpose,
  type PurposeFilter,
} from "../api/purposes";

export const PURPOSES_KEY = ["master-data", "purposes"] as const;

/** Purposes for a project (FR-MAS-011). Disabled until a project is chosen. */
export function usePurposes(projectId: string | null, filter: PurposeFilter) {
  return useQuery({
    queryKey: [...PURPOSES_KEY, projectId, filter],
    queryFn: () => listPurposes(projectId!, filter),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PURPOSES_KEY });
}

export function useCreatePurpose() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      createPurpose(projectId, name),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useRenamePurpose() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      projectId,
      id,
      input,
    }: {
      projectId: string;
      id: string;
      input: { name: string; version: number };
    }) => renamePurpose(projectId, id, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useDeactivatePurpose() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ projectId, id, version }: { projectId: string; id: string; version: number }) =>
      deactivatePurpose(projectId, id, version),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useReactivatePurpose() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ projectId, id, version }: { projectId: string; id: string; version: number }) =>
      reactivatePurpose(projectId, id, version),
    onSuccess: invalidate,
    retry: false,
  });
}
