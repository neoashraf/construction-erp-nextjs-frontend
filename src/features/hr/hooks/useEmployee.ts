import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getEmployee } from "../api/employees";

/**
 * Single-employee detail hook (spec §6). `reveal=true` requests the raw bank fields —
 * the server enforces `hr:employee:write` (HR/Admin) and audits the access (NFR-002).
 * The reveal state re-keys the query so a "Show"/"Hide" toggle round-trips cleanly.
 */
export function useEmployee(id: string | null, opts: { reveal?: boolean } = {}) {
  const reveal = opts.reveal ?? false;
  return useQuery({
    queryKey: [...queryKeys.detail("hr", "employees", id ?? "new"), reveal ? "revealed" : "masked"],
    queryFn: () => getEmployee(id as string, { reveal }),
    enabled: !!id,
  });
}
