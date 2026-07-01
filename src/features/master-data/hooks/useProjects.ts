import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  changeProjectStatus,
  type ProjectListFilter,
  type ProjectWriteInput,
  type StatusAction,
} from "../api/projects";

export const PROJECTS_KEY = ["master-data", "projects"] as const;

/** The company's projects (FR-MAS-005). */
export function useProjectsList(filter: ProjectListFilter = {}) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("master-data", "projects", scope, filter as Record<string, unknown>),
    queryFn: () => listProjects(filter),
    placeholderData: keepPreviousData,
  });
}

export function useProject(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("master-data", "projects", id),
    queryFn: () => getProject(id),
    enabled: enabled && !!id,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PROJECTS_KEY });
}

export function useCreateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (i: ProjectWriteInput) => createProject(i),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<ProjectWriteInput> & { version: number };
    }) => updateProject(id, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useChangeProjectStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action, version }: { id: string; action: StatusAction; version: number }) =>
      changeProjectStatus(id, action, version),
    onSuccess: invalidate,
    retry: false,
  });
}
