import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createGrn,
  deleteGrn,
  postGrn,
  updateGrn,
  type GrnWriteInput,
} from "../api/grns";

/**
 * GRN lifecycle mutations (nextjs-author skill §7). Save (create / update) is
 * DRAFT-only; **Post** is atomic — INV `receiveIn` per line in one transaction —
 * and never optimistic (the badge waits for the response). The API exposes no
 * cancel/repost for GRN; correction is via the parent bill. Every mutation
 * invalidates the list + affected detail so the screen reconciles to server state.
 */
export function useGrnMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["purchase", "grns", "list"] });
    if (id) qc.invalidateQueries({ queryKey: ["purchase", "grn", "detail", id] });
    // A GRN post rolls stock, which the on-hand badge reads back — invalidate it.
    qc.invalidateQueries({ queryKey: ["inventory", "stock-balance"] });
  };

  const create = useMutation({
    mutationFn: (input: GrnWriteInput) => createGrn(input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: GrnWriteInput & { version: number } }) =>
      updateGrn(id, input),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGrn(id),
    onSuccess: (_data, id) => invalidate(id),
    retry: false,
  });

  const post = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => postGrn(id, version),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  return { create, update, remove, post };
}
