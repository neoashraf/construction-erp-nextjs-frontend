import { useQuery } from "@tanstack/react-query";
import { listAssignments } from "../api/employees";

/**
 * Append-only assignment history for an employee (FR-HR-002). Newest-first; every
 * employee has ≥1 row from creation, so this query never yields a blank state for a
 * valid id — only loading, error, or the populated list.
 */
export function useAssignments(id: string | null) {
  return useQuery({
    queryKey: ["hr", "employees", "assignments", id ?? ""],
    queryFn: () => listAssignments(id as string),
    enabled: !!id,
  });
}
