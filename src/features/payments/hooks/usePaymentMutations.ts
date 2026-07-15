import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePayment } from "../api/payment";

/**
 * List-scope mutation: hard-delete a DRAFT payment (FR-PAY-020). No ledger impact
 * and no allocation effect. Editor/viewer add create/patch/post/cancel/repost via
 * their own mutations hook; this one only exposes what the list itself performs.
 * `retry:false` — non-idempotent.
 */
export function usePaymentMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["payments"] });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deletePayment(id),
    onSuccess: () => invalidate(),
    retry: false,
  });

  return { remove };
}
