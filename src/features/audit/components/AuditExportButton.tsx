"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { triggerAuditExport, isExportEligible } from "../hooks/use-audit-logs";
import { type AuditLogFilter, type AuditExportFormat } from "../types";

/**
 * The filtered export CTA (FR-AUD-028; spec §5/§6/§9) — FULLY WIRED against the
 * live `GET /api/audit-logs/export` (the `aud-audit-log-export` backend follow-up
 * has merged). Reflects the CURRENT filter set + a chosen `format=csv|xlsx`; a
 * real file download starts via a blob + anchor click (the endpoint is a genuine
 * `StreamableFile` with `Content-Disposition: attachment`, confirmed against the
 * merged backend controller — not a signed URL or async job, so there is no
 * polling/async-ready state to build). States: idle "Export" -> "Exporting…" +
 * spinner (in-flight) -> "Export ready." toast naming the downloaded file (spec §6/
 * §8) on success, or the mapped error on failure. Disabled while offline or when
 * 2+ actions are selected (the endpoint accepts one `action` value — see
 * `isExportEligible`), each with an inline reason so the control never fails
 * silently.
 */
export function AuditExportButton({
  filter,
  count,
  offline,
}: {
  filter: Omit<AuditLogFilter, "page" | "pageSize" | "action"> & { actions: string[] };
  /** The current filtered result count, shown for export reproducibility (spec §9). */
  count: number;
  offline: boolean;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = isExportEligible(filter.actions);
  const activeFilterCount = countActiveFilters(filter);
  const disabled = offline || exporting || !eligible;

  async function run(format: AuditExportFormat) {
    setError(null);
    setExporting(true);
    try {
      const { blob, filename } = await triggerAuditExport({ filter, format });
      downloadBlob(blob, filename);
      toast(`Export ready. ${filename}`, "success");
    } catch (e) {
      const apiErr = asApiError(e);
      const message =
        apiErr.code === "FORBIDDEN"
          ? "You don't have access to export the audit log."
          : apiErr.code === "VALIDATION_ERROR"
            ? apiErr.message || "Couldn't export — check the selected filters."
            : "Couldn't export the audit log. Please try again.";
      setError(message);
      toast(message, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={disabled}
            aria-label={exporting ? "Exporting audit log" : "Export audit log"}
            data-testid="audit-export-button"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden />
                Export
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => run("csv")} data-testid="audit-export-csv">
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run("xlsx")} data-testid="audit-export-xlsx">
            Export as XLSX
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-[11px] text-faint" data-testid="audit-export-summary">
        {activeFilterCount > 0
          ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied · ${count.toLocaleString("en-IN")} rows`
          : `No filters applied · ${count.toLocaleString("en-IN")} rows`}
      </span>

      {!eligible && (
        <span
          className="text-[11px] text-destructive-ink"
          data-testid="audit-export-multi-action-hint"
        >
          Export supports one action at a time — narrow the Action filter to export.
        </span>
      )}

      {error && (
        <span
          role="alert"
          className="text-[11px] text-destructive-ink"
          data-testid="audit-export-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}

function countActiveFilters(
  filter: Omit<AuditLogFilter, "page" | "pageSize" | "action"> & { actions: string[] },
): number {
  let n = 0;
  if (filter.userId) n += 1;
  if (filter.entityType) n += 1;
  if (filter.entityId) n += 1;
  if (filter.projectId) n += 1;
  if (filter.dateFrom) n += 1;
  if (filter.dateTo) n += 1;
  n += filter.actions.length;
  return n;
}

/** Trigger a real browser download from a Blob (no download endpoint elsewhere in the app to reuse). */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
