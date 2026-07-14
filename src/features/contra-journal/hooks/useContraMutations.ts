import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContraVoucher,
  deleteContraVoucher,
  postContraVoucher,
  reverseContraVoucher,
  updateContraVoucher,
  type ContraWriteInput,
} from "../api/contra";

/**
 * Contra-voucher lifecycle mutations (skill §7; FR-GEN-014…-018). Create/edit/delete a
 * DRAFT; Post allocates the gapless number via LED atomically; Reverse writes the
 * linked reversal. Every mutation invalidates the contra-journal subtree — no
 * optimistic status flip. `retry:false` on non-idempotent writes.
 */
export function useContraMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["contra-journal"] });

  const create = useMutation({
    mutationFn: (input: ContraWriteInput) => createContraVoucher(input),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContraWriteInput & { version: number } }) =>
      updateContraVoucher(id, input),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteContraVoucher(id),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const post = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => postContraVoucher(id, version),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const reverse = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      reverseContraVoucher(id, { reason, version }),
    onSuccess: () => invalidate(),
    retry: false,
  });

  return { create, update, remove, post, reverse };
}
