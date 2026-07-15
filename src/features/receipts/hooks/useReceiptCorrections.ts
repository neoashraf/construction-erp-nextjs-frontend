import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelReceipt, repostReceipt, type ReceiptWriteInput } from "../api/receipt";

/**
 * Cancel / repost mutations for the receipt viewer (skill §7; FR-REC-021/-022/-023).
 * Cancel reverses a POSTED receipt; Repost reverse-and-reposts corrected figures as a
 * new numbered entry. Every mutation invalidates the receipts subtree so the list +
 * the affected detail reconcile to server state — NO optimistic status flip.
 * `retry:false` — non-idempotent writes.
 */
export function useReceiptCorrections() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["receipts"] });

  const cancel = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      cancelReceipt(id, { reason, version }),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const repost = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: ReceiptWriteInput & { reason: string; version: number };
    }) => repostReceipt(id, input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  return { cancel, repost };
}
