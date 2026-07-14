import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelPayment,
  createPayment,
  deletePayment,
  postPayment,
  repostPayment,
  updatePayment,
  type PaymentWriteInput,
} from "../api/payment";

/**
 * Payment voucher-lifecycle mutations (skill §7; FR-PAY-001…-020). Create/edit/delete
 * a DRAFT; Post allocates the gapless number + writes the ledger via LED atomically;
 * Cancel reverses; Repost reverse-and-reposts. Every mutation invalidates the payments
 * subtree so the list + affected detail reconcile to server state — NO optimistic
 * status flip on Post/Cancel/Repost (server-confirmed, atomic). `retry:false` — these
 * are non-idempotent writes.
 */
export function usePaymentEditorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["payments"] });

  const create = useMutation({
    mutationFn: (input: PaymentWriteInput) => createPayment(input),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PaymentWriteInput & { version: number } }) =>
      updatePayment(id, input),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deletePayment(id),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const post = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => postPayment(id, version),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const cancel = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      cancelPayment(id, { reason, version }),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const repost = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: PaymentWriteInput & { reason: string; version: number };
    }) => repostPayment(id, input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  return { create, update, remove, post, cancel, repost };
}
