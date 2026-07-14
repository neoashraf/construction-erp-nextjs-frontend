import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createJournalVoucher,
  deleteJournalVoucher,
  postJournalVoucher,
  reverseJournalVoucher,
  updateJournalVoucher,
  type JournalWriteInput,
} from "../api/journal";

/**
 * Journal-voucher lifecycle mutations (skill §7; FR-GEN-004…-018). Create/edit/delete a
 * DRAFT; Post allocates the gapless number via LED atomically; Reverse writes the
 * linked reversal. `retry:false` on non-idempotent writes; every mutation invalidates
 * the contra-journal subtree.
 */
export function useJournalMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["contra-journal"] });

  const create = useMutation({
    mutationFn: (input: JournalWriteInput) => createJournalVoucher(input),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: JournalWriteInput & { version: number } }) =>
      updateJournalVoucher(id, input),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteJournalVoucher(id),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const post = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => postJournalVoucher(id, version),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const reverse = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      reverseJournalVoucher(id, { reason, version }),
    onSuccess: () => invalidate(),
    retry: false,
  });

  return { create, update, remove, post, reverse };
}
