import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createReceipt,
  deleteReceipt,
  postReceipt,
  updateReceipt,
  type ReceiptWriteInput,
} from "../api/receipt";

/**
 * Receipt draft-lifecycle mutations (skill §7; FR-REC-001…-014, -024). Create/edit/delete
 * a DRAFT; Post allocates the gapless number + writes the ledger via LED atomically. Every
 * mutation invalidates the list + the affected detail so the screen reconciles to server
 * state — NO optimistic status flip on Post (server-confirmed, atomic). Cancel/repost live
 * on FE-44 (viewer) and are added there. `retry:false` — non-idempotent writes.
 */
export function useReceiptMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["receipts"] });
    if (id) qc.invalidateQueries({ queryKey: ["receipts", "detail"] });
  };

  const create = useMutation({
    mutationFn: (input: ReceiptWriteInput) => createReceipt(input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReceiptWriteInput & { version: number } }) =>
      updateReceipt(id, input),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteReceipt(id),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const post = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => postReceipt(id, version),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  return { create, update, remove, post };
}
