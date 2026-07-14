import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { getReportCatalog, runReport, exportReport, saveBlob } from "../api/reports";
import { type ReportDescriptor, type ReportFormat, type ReportParams } from "../types";

/**
 * FE-54 shared hooks. The catalog is filtered server-side by permission, but
 * the FE re-filters defensively so a stale cache never surfaces a forbidden
 * report (FR-RPT-008). Run is a query; Export is a mutation returning a Blob.
 */
export function useReportCatalog() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("reports", "catalog", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: getReportCatalog,
    staleTime: 60_000,
    select: (data) => {
      // Defensive re-filter — a report the caller can't run is absent.
      return data.filter((d) => {
        if (user.role === "ADMIN") return true;
        if (!user.permissions) return true; // degraded: trust the server list
        return hasGrant(
          { role: user.role, permissions: user.permissions },
          d.requiredPermission,
          "READ",
        );
      });
    },
  });
}

export function useRunReport<Row = Record<string, unknown>>(
  descriptor: ReportDescriptor | null,
  params: ReportParams | null,
  enabled: boolean,
) {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.detail(
      "reports",
      "run",
      `${user.companyId}:${user.financialYearId}:${descriptor?.name ?? ""}:${JSON.stringify(params ?? {})}`,
    ),
    queryFn: () => runReport<Row>(descriptor!.name, params!),
    enabled: !!descriptor && !!params && enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useReportExport() {
  return useMutation({
    mutationFn: async ({
      name,
      params,
      format,
    }: {
      name: string;
      params: ReportParams;
      format: Extract<ReportFormat, "excel" | "pdf">;
    }) => {
      const result = await exportReport(name, params, format);
      saveBlob(result.blob, result.filename);
      return result.filename;
    },
  });
}
