"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { fetchExportCsv, type AttendanceLogFilters, type ExportType } from "../api/attendance-logs";
import { downloadCsvAsXlsx } from "../lib/attendance-export";
import { exportFilename, filtersForExport } from "../lib/attendance-filters";

/**
 * Excel export. All three report types stay selectable regardless of the current view —
 * the highlighted one is a suggestion, not a restriction — and the active filters are
 * *translated* to fit the chosen type rather than dropped (see `filtersForExport`).
 */

const EXPORT_OPTIONS: { type: ExportType; label: string; hint: string }[] = [
  { type: "summary", label: "Summary totals", hint: "One row per employee" },
  { type: "range", label: "Detailed day-by-day", hint: "Every date for every employee" },
  { type: "daily", label: "Single day", hint: "One row per employee for one day" },
];

export function ExportMenu({
  filters,
  suggested,
  disabled,
}: {
  filters: AttendanceLogFilters;
  suggested: ExportType;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function runExport(type: ExportType) {
    setBusy(true);
    try {
      const scoped = filtersForExport(type, filters);
      const csv = await fetchExportCsv(type, scoped);
      await downloadCsvAsXlsx(csv, exportFilename(type, scoped));
      toast("Export downloaded", "success");
    } catch (error) {
      // Surface the server's own wording — it explains real constraints the user can act
      // on, e.g. "date range cannot exceed 90 days". A plain Error (bad content type) also
      // carries a useful message, so don't flatten it to a generic failure.
      toast(error instanceof Error ? error.message : "Export failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          aria-haspopup="menu"
          data-testid="export-menu"
        >
          <Download className="h-4 w-4" aria-hidden />
          {busy ? "Exporting…" : "Export"}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[264px]">
        {EXPORT_OPTIONS.map((option) => (
          // The shared item is a fixed-height single-line row; these are two-line, so the
          // height and vertical centring are overridden rather than fought.
          <DropdownMenuItem
            key={option.type}
            onSelect={() => void runExport(option.type)}
            className="h-auto flex-col items-start gap-0.5 py-2"
          >
            <span className="flex w-full items-center gap-2">
              <span className="text-[13px] font-semibold leading-tight text-foreground">
                {option.label}
              </span>
              {option.type === suggested ? (
                <span className="ml-auto flex-none rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold leading-none text-accent-ink">
                  Suggested
                </span>
              ) : null}
            </span>
            <span className="text-[11.5px] font-normal leading-tight text-muted-foreground">
              {option.hint}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
