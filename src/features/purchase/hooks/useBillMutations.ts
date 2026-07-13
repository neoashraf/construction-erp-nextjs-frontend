import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelPurchaseBill,
  createPurchaseBill,
  deletePurchaseBill,
  postPurchaseBill,
  repostPurchaseBill,
  updatePurchaseBill,
  type PurchaseBillWriteInput,
} from "../api/bills";

/**
 * Purchase Bill lifecycle mutations (nextjs-author skill §7). Save (create/update) is
 * DRAFT-only; **Post** is atomic — LED + INV + NUM in one transaction — and never
 * optimistic (the badge waits for the response). Cancel and Repost take a mandatory
 * reason; both may return `409 BILL_HAS_APPLIED_PAYMENTS` (block) or `409 ALREADY_REVERSED`
 * (stale). Every mutation invalidates the list + affected detail so the screen
 * reconciles to server state. `retry:false` — writes are non-idempotent.
 */
export function useBillMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["purchase", "bills", "list"] });
    if (id) qc.invalidateQueries({ queryKey: ["purchase", "bill", "detail", id] });
  };

  const create = useMutation({
    mutationFn: (input: PurchaseBillWriteInput) => createPurchaseBill(input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PurchaseBillWriteInput & { version: number } }) =>
      updatePurchaseBill(id, input),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePurchaseBill(id),
    onSuccess: (_data, id) => invalidate(id),
    retry: false,
  });

  const post = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => postPurchaseBill(id, version),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      cancelPurchaseBill(id, { reason, version }),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const repost = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: PurchaseBillWriteInput & { reason: string; version: number };
    }) => repostPurchaseBill(id, input),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  return { create, update, remove, post, cancel, repost };
}
