"use client";

import { useState } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { useReportExport } from "../hooks/useReportCatalog";
import { type ReportFormat, type ReportParams } from "../types";

/**
 * FE-54 shared export control (spec §5/§9; FR-RPT-029/-031). Matches the design:
 * a segmented **format selector** — `On-screen (JSON) · Excel (.xlsx) · PDF`
 * (navy active) — followed by a dedicated **Export** button. Selecting a format
 * is inert; pressing Export re-issues the same query with the chosen `format`
 * and streams a binary download (the on-screen table is never re-rendered).
 * With `On-screen (JSON)` selected the report is already visible, so Export is a
 * no-op and shown disabled. Empty results still export a well-formed empty file.
 */
export interface ReportExportControlProps {
  reportName: string;
  params: ReportParams;
  /** Disable when the run itself is disabled (e.g. offline). */
  disabled?: boolean;
}

const FORMAT_LABEL: Record<ReportFormat, string> = {
  json: "On-screen (JSON)",
  excel: "Excel (.xlsx)",
  pdf: "PDF",
};

export function ReportExportControl({ reportName, params, disabled }: ReportExportControlProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ReportFormat>("json");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const exportMut = useReportExport();

  const busy = exportMut.isPending;

  async function onExport() {
    setErrorMsg(null);
    if (format === "json") return; // Already rendered on-screen — nothing to download.
    try {
      const filename = await exportMut.mutateAsync({ name: reportName, params, format });
      toast(`Download started — ${filename}`, "success");
    } catch (err) {
      setErrorMsg(mapExportError(asApiError(err).code));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="report-export-control">
      <div
        role="radiogroup"
        aria-label="Export format"
        className="flex items-center gap-1 rounded-token border border-border-strong bg-background p-1"
      >
        {(["json", "excel", "pdf"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={format === f}
            onClick={() => {
              setFormat(f);
              setErrorMsg(null);
            }}
            disabled={disabled || busy}
            className={cn(
              "rounded-token px-3 py-1.5 text-[12px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "disabled:cursor-not-allowed disabled:opacity-60",
              format === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
            data-testid={`report-export-${f}`}
          >
            {FORMAT_LABEL[f]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onExport}
        disabled={disabled || busy || format === "json"}
        aria-busy={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-token bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-colors",
          "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        data-testid="report-export-run"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        )}
        <Download className="h-3.5 w-3.5" aria-hidden />
        Export
      </button>

      {busy && (
        <span className="text-[11px] text-muted-foreground" data-testid="export-preparing">
          Preparing file…
        </span>
      )}
      {errorMsg && (
        <span className="text-[11px] text-destructive" role="alert" data-testid="export-error">
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
