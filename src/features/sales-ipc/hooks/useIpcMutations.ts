import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelIpc,
  createIpc,
  deleteIpc,
  postIpc,
  repostIpc,
  updateIpc,
  type IpcWriteInput,
} from "../api/ipc";

/**
 * IPC voucher-lifecycle mutations (skill §7; FR-SAL-001…-023). Create/edit/delete a DRAFT;
 * Post allocates the gapless number + writes the ledger; Cancel reverses; Repost reverse-and-
 * reposts. Every mutation invalidates the list + the affected detail so the screen reconciles to
 * server state — NO optimistic status flip on Post/Cancel/Repost (server-confirmed, atomic).
 * `retry:false` — these are non-idempotent writes.
 */
export function useIpcMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["sales-ipc", "ipc", "list"] });
    if (id) qc.invalidateQueries({ queryKey: ["sales-ipc", "ipc", "detail", id] });
  };

  const create = useMutation({
    mutationFn: (input: IpcWriteInput) => createIpc(input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IpcWriteInput & { version: number } }) => updateIpc(id, input),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteIpc(id),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const post = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => postIpc(id, version),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string; version: number }) =>
      cancelIpc(id, { reason, version }),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const repost = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IpcWriteInput & { reason: string; version: number } }) =>
      repostIpc(id, input),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  return { create, update, remove, post, cancel, repost };
}
