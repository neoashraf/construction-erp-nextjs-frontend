import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getReceiptsForIpc, listReceipts, type ReceiptListFilter } from "../api/receipt";

/**
 * Paginated receipt list (nextjs-author skill §7). READ-ONLY — a query only; this
 * screen mutates nothing. Keys are tenant/FY-scoped so a company/FY switch doesn't
 * bleed cached pages across contexts. `placeholderData` keeps the previous page
 * visible (dimmed via CSS) while a new filter/page loads.
 */
export function useReceipts(filter: ReceiptListFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("receipts", "list", scope, { ...filter }),
    queryFn: () => listReceipts(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/**
 * The IPC deep-link context (FR-REC-016/-018) — backs the "Filtered to IPC …" chip.
 * Only fires once an `ipcId` is present (the deep link, or the secondary "Filters"
 * IPC field echoing it back).
 */
export function useReceiptsForIpc(ipcId: string) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.detail(
      "receipts",
      "ipc-context",
      `${scope.companyId}:${scope.financialYearId}:${ipcId}`,
    ),
    queryFn: () => getReceiptsForIpc(ipcId),
    enabled: !!ipcId,
    retry: false,
  });
}
