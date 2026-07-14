import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type IpcRegister, type RetentionRelease } from "../types";

/**
 * IPC register + retention-release API bindings (API contract 10 § "Project IPC register",
 * § "Retention Release"; FR-SAL-015…-020). The register is a pure read (per-project rows +
 * running cumulative totals + a project-level totals object, all server-computed queries).
 * The release is the one write action on this screen — server-confirmed, no draft,
 * `POST …/{id}/release-retention` returns 201 POSTED atomically with a gapless entryNo via
 * LED's `PostingService`. `companyId` implicit from the JWT; PM readers scoped to assigned
 * projects server-side. Shared with the register table + retention panel + release dialog.
 */

/** Double-submit CSRF token for every state-changing call (skill §4). */
function csrf() {
  return { csrfToken: readCsrfToken() };
}

/**
 * `GET /api/sales/projects/{projectId}/register` — the per-project register (contract 10).
 * `financialYearId?` optionally narrows the query; omit → project-lifetime.
 */
export async function getIpcRegister(projectId: string, financialYearId?: string): Promise<IpcRegister> {
  const q = financialYearId ? `?financialYearId=${encodeURIComponent(financialYearId)}` : "";
  const res = await apiClient.get<{ data: IpcRegister }>(`/sales/projects/${projectId}/register${q}`);
  return res.data;
}

export interface ReleaseRetentionInput {
  /** `YYYY-MM-DD` — resolves the FY/period for the release posting (FR-SAL-020). */
  releaseDate: string;
  /** Omit → release the full held amount (FR-SAL-019). Server enforces `≤ retentionHeldAmount`. */
  releasedAmount?: string;
  /** Optional Bangla-safe narration; wraps, never clips. */
  narration?: string;
}

export interface ReleaseRetentionResult {
  id: string;
  ipcId: string;
  entryNo: string;
  releasedAmount: string;
  status: "POSTED";
}

/**
 * `POST /api/sales/ipc/{id}/release-retention` — post a retention release against an IPC
 * (Dr AR / Cr Retention Receivable, LED `PostingService`, gapless entryNo). Bounded by
 * `retentionHeldAmount` (409 `OVER_RELEASE`); obeys `PERIOD_CLOSED` / `NO_PERIOD_DEFINED` /
 * `PROJECT_CLOSED` / `VOUCHER_NOT_POSTED` (FR-SAL-018…-020).
 */
export async function releaseRetention(
  ipcId: string,
  input: ReleaseRetentionInput,
): Promise<ReleaseRetentionResult> {
  const res = await apiClient.post<{ data: ReleaseRetentionResult }>(
    `/sales/ipc/${ipcId}/release-retention`,
    input,
    csrf(),
  );
  return res.data;
}

/**
 * `GET /api/sales/ipc/{id}/retention-releases` — the audit list of retention releases
 * already posted against this IPC (spec §5 "Retention releases list"). PM: assigned-project
 * scoped server-side; a single-IPC failure surfaces as a partial state (spec §6).
 */
export async function listRetentionReleases(ipcId: string): Promise<RetentionRelease[]> {
  const res = await apiClient.get<{ data: RetentionRelease[] }>(`/sales/ipc/${ipcId}/retention-releases`);
  return res.data;
}
