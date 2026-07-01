import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { type Paginated } from "@/lib/api/pagination";
import { listAuditLogs, getAuditLog, exportAuditLogs, type AuditExportResult } from "../api";
import { type AuditLogFilter, type AuditLogRow, type AuditExportFormat } from "../types";

/**
 * Audit-log list hook (FR-AUD-020/021/026/027; spec §6/§9). READ-ONLY — a query
 * only, no mutations (the log is append-only, FR-AUD-023). `keepPreviousData`
 * keeps prior rows visible (dimmed) while a new filter/page loads, matching the
 * ledger screens' convention.
 *
 * `filter.action` carries at most one action to the server; a multi-select of N>1
 * actions is realised by `useAuditLogs` issuing N parallel requests (one per
 * selected action, same filter set otherwise) and merging the results
 * newest-first client-side — the live API only accepts one `action` value per
 * request (confirmed against the merged backend controller), so this is the only
 * way to honour a combinable multi-select without inventing a backend capability.
 */
export function useAuditLogs(
  filter: Omit<AuditLogFilter, "action"> & { actions: string[] },
  enabled = true,
) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  const { actions, ...rest } = filter;

  return useQuery({
    queryKey: queryKeys.list("audit", "audit-logs", scope, { ...rest, actions } as Record<
      string,
      unknown
    >),
    queryFn: async (): Promise<Paginated<AuditLogRow>> => {
      if (actions.length <= 1) {
        return listAuditLogs({ ...rest, action: actions[0] });
      }

      // Multi-action: fetch each action's full first-N pages worth in one page-
      // sized-for-merge request, then merge + re-sort + re-paginate client-side.
      const pages = await Promise.all(
        actions.map((action) => listAuditLogs({ ...rest, action, page: 1, pageSize: 200 })),
      );
      const merged = pages
        .flatMap((p) => p.data)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

      const page = rest.page ?? 1;
      const pageSize = rest.pageSize ?? 25;
      const start = (page - 1) * pageSize;
      return {
        data: merged.slice(start, start + pageSize),
        page,
        pageSize,
        total: merged.length,
      };
    },
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  });
}

/** A single audit-log entry with its before/after diff + seal (FR-AUD-022/024). */
export function useAuditLogDetail(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("audit", "audit-logs", id ?? ""),
    queryFn: () => getAuditLog(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}

export interface UseAuditExportArgs {
  filter: Omit<AuditLogFilter, "page" | "pageSize" | "action"> & { actions: string[] };
  format: AuditExportFormat;
}

/**
 * True when the current filter set can be sent to `GET /api/audit-logs/export`
 * as-is — i.e. at most one action is selected. The export endpoint (like the
 * list) accepts a single `action` value; unlike the list, a file download can't
 * be client-side-merged across several requests, so an export with 2+ actions
 * selected asks the Admin to narrow to one action first (spec §7 validation
 * pattern — an inline message on the offending filter, same shape as the
 * date-range check) rather than silently exporting only one of them.
 */
export function isExportEligible(actions: string[]): boolean {
  return actions.length <= 1;
}

/**
 * The export trigger (FR-AUD-028). Not a TanStack mutation against a JSON
 * resource — it downloads a file — so this is a thin async function the export
 * button calls directly, tracking its own in-flight state (spec §6 "Exporting…").
 * Reflects the CURRENT filter set exactly (reproducibility, spec §9) — callers
 * must check `isExportEligible` first (the button is disabled otherwise).
 */
export async function triggerAuditExport({
  filter,
  format,
}: UseAuditExportArgs): Promise<AuditExportResult> {
  const { actions, ...rest } = filter;
  return exportAuditLogs({ ...rest, action: actions[0] }, format);
}
