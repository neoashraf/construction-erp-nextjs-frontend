import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRequisition,
  deleteRequisition,
  submitRequisition,
  updateRequisition,
  type RequisitionWriteInput,
} from "../api/requisition";

/**
 * Requisition draft-lifecycle mutations (skill §7; FR-REQ-006). Create/edit/delete a DRAFT;
 * Submit is server-confirmed (allocates `requisitionNo`, computes `estimatedValue`, selects
 * the tier server-side). Every mutation invalidates the list + the affected detail so the
 * screen reconciles to server state (no optimistic status flip on Submit). `retry:false` —
 * these are non-idempotent writes.
 */
export function useRequisitionMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["requisitions", "requisition", "list"] });
    if (id) qc.invalidateQueries({ queryKey: ["requisitions", "requisition", "detail", id] });
  };

  const create = useMutation({
    mutationFn: (input: RequisitionWriteInput) => createRequisition(input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RequisitionWriteInput & { version: number } }) =>
      updateRequisition(id, input),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deleteRequisition(id, version),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  const submit = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => submitRequisition(id, version),
    onSuccess: (_data, { id }) => invalidate(id),
    retry: false,
  });

  return { create, update, remove, submit };
}
