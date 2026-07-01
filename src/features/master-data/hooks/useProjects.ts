import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listProjects, type ProjectListFilter } from "../api/projects";

export const PROJECTS_KEY = ["master-data", "projects"] as const;

/** The company's projects (FR-MAS-005). Used by pickers and the projects screen. */
export function useProjectsList(filter: ProjectListFilter = {}) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("master-data", "projects", scope, filter as Record<string, unknown>),
    queryFn: () => listProjects(filter),
    placeholderData: keepPreviousData,
  });
}
