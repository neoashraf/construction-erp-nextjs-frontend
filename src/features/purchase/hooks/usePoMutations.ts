import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderWriteInput,
} from "../api/orders";

/**
 * Purchase Order lifecycle mutations (nextjs-author skill §7; FR-PUR-001/-002/-024). Save
 * (create/update) is DRAFT-only; Approve is server-confirmed with NO optimistic status
 * flip (the badge waits for the fresh response); Cancel takes a mandatory reason and may
 * return `409 PO_HAS_BILLS`. Every mutation invalidates the list + affected detail so the
 * screen reconciles to server state. `retry:false` — writes are non-idempotent.
 */
export function usePoMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["purchase", "orders", "list"] });
    if (id) qc.invalidateQueries({ queryKey: ["purchase", "order", "detail", id] });
  };

  const create = useMutation({
    mutationFn: (input: PurchaseOrderWriteInput) => createPurchaseOrder(input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PurchaseOrderWriteInput & { version: number } }) =>
      updatePurchaseOrder(id, input),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const approve = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => approvePurchaseOrder(id, version),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      cancelPurchaseOrder(id, { reason, version }),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  return { create, update, approve, cancel };
}
