import { apiClient } from "@/lib/api";

/**
 * A thin, read-only binding to SAL's own IPC list (API contract 10 `GET /api/sales/ipc`),
 * used only to resolve an IPC's display label (`entryNo`) — for this list's "IPC" column
 * (spec §5: "Resolved IPC reference/label for IPC_LINKED rows") and the deep-link context
 * chip (FR-REC-016). This mirrors the established cross-module picker pattern (e.g. PUR's
 * `api/masters.ts` reading MAS's `/masters/parties` directly) — a module calls a sibling
 * module's own public endpoint via its own local `api/` binding, never by importing the
 * sibling's `features/` code (skill §2.4). REC never redefines the IPC (contract 11 "Not
 * endpoints") — this only reads SAL's own resource for a label, exactly as SAL exposes it.
 * Only `POSTED` IPCs are referenceable by a receipt (FR-REC-002), so this scopes to those.
 */
export interface IpcOption {
  id: string;
  entryNo: string | null;
  projectId: string;
}

export async function listIpcOptions(): Promise<IpcOption[]> {
  const res = await apiClient.get<{ data: IpcOption[] }>(
    "/sales/ipc?status=POSTED&page=1&pageSize=500",
  );
  return res.data;
}
