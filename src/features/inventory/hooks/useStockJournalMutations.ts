import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  approveStockJournal,
  createStockJournal,
  deleteStockJournal,
  postStockJournal,
  reverseStockJournal,
  updateStockJournal,
  type PostStockJournalInput,
  type StockJournalWriteInput,
} from "../api/stock-journal";
import { STOCK_JOURNALS_KEY } from "./useStockJournals";

/**
 * Stock Journal lifecycle mutations (skill §7; spec §9). ALL server-confirmed — no
 * optimistic status flip anywhere (posting is atomic + irreversible-except-by-reversal,
 * FR-INV-018). Each invalidates the list + the affected detail so the header badge and
 * row reflect the server's response, never a local guess.
 */
export function useStockJournalMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: STOCK_JOURNALS_KEY });
    if (id) qc.invalidateQueries({ queryKey: queryKeys.detail("inventory", "stock-journal", id) });
  };

  const create = useMutation({
    mutationFn: (input: StockJournalWriteInput) => createStockJournal(input),
    onSuccess: (sj) => invalidate(sj.id),
    retry: false,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: StockJournalWriteInput & { version: number } }) =>
      updateStockJournal(id, input),
    onSuccess: (sj) => invalidate(sj.id),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deleteStockJournal(id, version),
    onSuccess: () => invalidate(),
    retry: false,
  });
  const approve = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => approveStockJournal(id, version),
    onSuccess: (sj) => invalidate(sj.id),
    retry: false,
  });
  const post = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PostStockJournalInput }) => postStockJournal(id, input),
    onSuccess: (sj) => invalidate(sj.id),
    retry: false,
  });
  const reverse = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      reverseStockJournal(id, reason, version),
    onSuccess: (sj) => invalidate(sj.id),
    retry: false,
  });

  return { create, update, remove, approve, post, reverse };
}
