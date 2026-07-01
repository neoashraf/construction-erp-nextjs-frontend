import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listItems,
  getItem,
  createItem,
  updateItem,
  deactivateItem,
  reactivateItem,
  type ItemFilter,
  type ItemWriteInput,
} from "../api/items";

export const ITEMS_KEY = ["master-data", "items"] as const;

export function useItemsList(filter: ItemFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("master-data", "items", scope, filter as Record<string, unknown>),
    queryFn: () => listItems(filter),
    placeholderData: keepPreviousData,
  });
}

export function useItem(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("master-data", "items", id),
    queryFn: () => getItem(id),
    enabled: enabled && !!id,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ITEMS_KEY });
}

export function useCreateItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (i: ItemWriteInput) => createItem(i),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useUpdateItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ItemWriteInput & { version: number } }) =>
      updateItem(id, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useDeactivateItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deactivateItem(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useReactivateItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => reactivateItem(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}
