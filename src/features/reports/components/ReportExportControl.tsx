"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { useReportExport } from "../hooks/useReportCatalog";
import { type ReportFormat, type ReportParams } from "../types";

/**
 * FE-54 shared export control (spec §5/§9; FR-RPT-029/-031). Radiogroup of
 * On-screen JSON · Excel · PDF. Choosing Excel/PDF re-issues the same query
 * with `format` changed and streams a binary download — the table is never
 * re-rendered. Empty results still export (a well-formed empty file).
 */
export interface ReportExportControlProps {
  reportName: string;
  params: ReportParams;
  /** Disable when the run itself is disabled (e.g. offline). */
  disabled?: boolean;
}

export function ReportExportControl({ reportName, params, disabled }: ReportExportControlProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ReportFormat>("json");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const exportMut = useReportExport();

  async function pick(next: ReportFormat) {
    setFormat(next);
    setErrorMsg(null);
    if (next === "json") return; // Already rendered on-screen.
    try {
      const filename = await exportMut.mutateAsync({ name: reportName, params, format: next });
      toast(`Download started — ${filename}`, "success");
    } catch (err) {
      setErrorMsg(mapExportError(asApiError(err).code));
    } finally {
      // Reset the choice so the next click re-triggers the download.
      setFormat("json");
    }
  }

  const busy = exportMut.isPending;

  return (
    <div
      role="radiogroup"
      aria-label="Export format"
      aria-busy={busy}
      className="flex items-center gap-1 rounded-token border border-border-strong bg-background p-1"
      data-testid="report-export-control"
    >
      {(["json", "excel", "pdf"] as const).map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={format === f}
          onClick={() => pick(f)}
          disabled={disabled || busy}
          className={cn(
            "flex items-center gap-1.5 rounded-token px-3 py-1.5 text-[12px] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            "disabled:cursor-not-allowed disabled:opacity-60",
            format === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
          )}
          data-testid={`report-export-${f}`}
        >
          {busy && format === f ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : f !== "json" ? (
            <Download className="h-3 w-3" aria-hidden />
          ) : null}
          {f === "json" ? "On-screen JSON" : f === "excel" ? "Excel" : "PDF"}
        </button>
      ))}
      {busy && (
        <span className="ml-2 text-[11px] text-muted-foreground" data-testid="export-preparing">
          Preparing file…
        </span>
      )}
      {errorMsg && (
        <span className="ml-2 text-[11px] text-destructive" role="alert" data-testid="export-error">
          {errorMsg}
        </span>
      )}
    </div>
  );
}

function mapExportError(code: string): string {
  switch (code) {
    case "FORBIDDEN":
      return "You don't have permission to export this report.";
    case "NETWORK_ERROR":
      return "Can't reach the server.";
    default:
      return "Couldn't prepare the file. Try again.";
  }
}
