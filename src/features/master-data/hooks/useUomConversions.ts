import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listConversions, upsertConversion, removeConversion } from "../api/items";
import { ITEMS_KEY } from "./useItems";

export const CONVERSIONS_KEY = ["master-data", "uom-conversions"] as const;

export function useUomConversions(itemId: string | null) {
  return useQuery({
    queryKey: [...CONVERSIONS_KEY, itemId],
    queryFn: () => listConversions(itemId!),
    enabled: !!itemId,
  });
}

function useInvalidate(itemId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [...CONVERSIONS_KEY, itemId] });
    // Base-UoM lock depends on whether conversions exist → refresh the item too.
    qc.invalidateQueries({ queryKey: ITEMS_KEY });
  };
}

export function useUpsertConversion(itemId: string) {
  const invalidate = useInvalidate(itemId);
  return useMutation({
    mutationFn: (input: { uom: string; factorToBase: string }) => upsertConversion(itemId, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useRemoveConversion(itemId: string) {
  const invalidate = useInvalidate(itemId);
  return useMutation({
    mutationFn: (id: string) => removeConversion(itemId, id),
    onSuccess: invalidate,
    retry: false,
  });
}
