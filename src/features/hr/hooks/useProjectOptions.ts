import { useQuery } from "@tanstack/react-query";
import { listProjectOptions } from "../api/masters";

/**
 * Cached project-options query for the HR create drawer + Reassign dialog. Reused across
 * both call sites via TanStack's cache. Silent degradation: on a failure the caller gets
 * an empty list and the server's `CROSS_COMPANY_REFERENCE` covers any picked id.
 */
export function useProjectOptions() {
  return useQuery({
    queryKey: ["hr", "project-options"],
    queryFn: listProjectOptions,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
