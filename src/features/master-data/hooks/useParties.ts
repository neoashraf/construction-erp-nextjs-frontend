import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listParties,
  getParty,
  createParty,
  updateParty,
  deactivateParty,
  reactivateParty,
  type PartyListFilter,
  type PartyWriteInput,
} from "../api/parties";

/** Broad key prefix for all party lists/details — used for invalidation. */
export const PARTIES_KEY = ["master-data", "parties"] as const;

/** Filtered, paginated party list (FR-MAS-022/024). */
export function usePartiesList(filter: PartyListFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("master-data", "parties", scope, filter as Record<string, unknown>),
    queryFn: () => listParties(filter),
    placeholderData: keepPreviousData,
  });
}

/** A single party by id (FR-MAS-023). */
export function useParty(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("master-data", "parties", id),
    queryFn: () => getParty(id),
    enabled: enabled && !!id,
  });
}

export function useCreateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PartyWriteInput) => createParty(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PARTIES_KEY }),
    retry: false,
  });
}

export function useUpdateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PartyWriteInput & { version: number } }) =>
      updateParty(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PARTIES_KEY }),
    retry: false,
  });
}

export function useDeactivateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deactivateParty(id, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: PARTIES_KEY }),
    retry: false,
  });
}

export function useReactivateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => reactivateParty(id, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: PARTIES_KEY }),
    retry: false,
  });
}
