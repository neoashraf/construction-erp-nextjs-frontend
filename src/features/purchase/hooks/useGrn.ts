import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getGrn } from "../api/grns";

/**
 * Single GRN read (nextjs-author skill §7). `retry:false` so 403/404 surface at
 * once — the entry screen renders permission-denied / not-found. A `null` id (the
 * `/purchase/grn/new` route) leaves the query disabled; the entry starts blank.
 */
export function useGrn(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("purchase", "grn", id ?? ""),
    queryFn: () => getGrn(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
