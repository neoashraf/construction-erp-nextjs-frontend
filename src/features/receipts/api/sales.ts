import { apiClient } from "@/lib/api";

/**
 * A thin, read-only binding to SAL's own IPC list + detail (API contract 10). REC calls
 * SAL's public endpoints for two purposes:
 * (1) the list-column label lookup (`entryNo`), and
 * (2) the editor's §A posted-IPC picker for a chosen customer + the picked IPC's
 *     inherited posting dimensions.
 * This mirrors the established cross-module picker pattern (skill §2.4 — a module calls
 * a sibling module's own public endpoint via its own local `api/` binding, never by
 * importing the sibling's `features/` code). REC never redefines the IPC (contract 11
 * "Not endpoints") — this only reads SAL's own resource shape.
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

/**
 * One posted-IPC row for the §A picker: SAL's IPC summary projection for a chosen
 * customer. `outstandingAmount` is the receipt-facing remaining currently-due
 * (SAL's derived `currentlyDue − Σ posted receipts`); the picker shows it and the
 * editor uses REC's own `GET /api/receipt/ipc/{ipcId}` as the authoritative source for
 * the live balance-due preview (see `useIpcOutstanding`).
 */
export interface IpcSummaryForCustomer {
  id: string;
  ipcSeqNo: number;
  entryNo: string | null;
  projectId: string;
  customerId: string;
  ipcDate: string;
  certifiedAmount: string;
  currentlyDueAmount: string;
  outstandingAmount: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
}

export async function listPostedIpcsForCustomer(customerId: string): Promise<IpcSummaryForCustomer[]> {
  if (!customerId) return [];
  const q = new URLSearchParams({
    status: "POSTED",
    customerId,
    page: "1",
    pageSize: "100",
  }).toString();
  const res = await apiClient.get<{ data: IpcSummaryForCustomer[] }>(`/sales/ipc?${q}`);
  return res.data.filter((r) => r.status === "POSTED");
}

/** One picked IPC's full detail — the editor reads `costCentreId`/`purposeId`/`projectId`
 *  to render the inherited-dimensions chips (server-confirmed values). */
export interface IpcDetail {
  id: string;
  projectId: string;
  customerId: string;
  ipcSeqNo: number;
  ipcDate: string;
  workCompletedPct: string;
  costCentreId: string;
  purposeId: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  entryNo: string | null;
  currentlyDueAmount: string;
  outstandingAmount: string;
}
export async function getIpcDetail(id: string): Promise<IpcDetail> {
  const res = await apiClient.get<{ data: IpcDetail }>(`/sales/ipc/${id}`);
  return res.data;
}
