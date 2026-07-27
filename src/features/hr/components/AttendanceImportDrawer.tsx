"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type ImportResult, type ImportRow } from "../api/attendance-logs";
import { describeImportResult, useImportAttendance } from "../hooks/useAttendanceLogs";
import { AttendanceImportError, downloadAttendanceTemplate, parseAttendanceWorkbook } from "../lib/attendance-export";

/**
 * Import attendance from a spreadsheet.
 *
 * Three steps — **choose → preview → result** — and the preview is not decoration. Import
 * writes to the same ledger-facing rail as the device, so the user gets to see what the file
 * actually parsed to (and how many rows look empty) before anything is written. Uploading a
 * file with the wrong columns is the most likely mistake, and it is far cheaper to catch it
 * in a preview than to explain it in an error toast afterwards.
 *
 * Parsing happens in the browser; only JSON rows are posted. Per-row validation lives on the
 * SERVER, so the messages shown here are the same ones a script hitting the API would get —
 * there is exactly one set of rules.
 */

type Step = "choose" | "preview" | "result";

/** Rows shown in the preview table. Enough to spot a mis-mapped column, few enough to scan. */
const PREVIEW_ROWS = 8;
/** Row errors listed in full before collapsing to a count — a long list stops being readable. */
const MAX_LISTED_ERRORS = 12;

export function AttendanceImportDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importer = useImportAttendance();

  function reset() {
    setStep("choose");
    setFileName("");
    setRows([]);
    setParseError(null);
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function handleClose() {
    if (importer.isPending) return;
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParseError(null);
    setFileName(file.name);

    try {
      const parsed = await parseAttendanceWorkbook(file);
      setRows(parsed);
      setStep("preview");
    } catch (error) {
      // A structural failure (no sheet, wrong headers) keeps the user on step one with the
      // reason visible, rather than advancing to an empty preview they can't interpret.
      setParseError(
        error instanceof AttendanceImportError
          ? error.message
          : "Could not read that file. Make sure it is a .xlsx or .csv workbook.",
      );
      setStep("choose");
    } finally {
      // Clear the input so re-picking the SAME file still fires `change` — otherwise a user
      // who fixes their spreadsheet and re-selects it gets no response at all.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function handleImport() {
    importer.mutate(rows, {
      onSuccess: (res) => {
        setResult(res);
        setStep("result");
        const blocked = res.reconciled === 0 && Object.keys(res.skippedReasons).length > 0;
        toast(describeImportResult(res), res.acceptedRows === 0 || blocked ? "error" : "success");
      },
      onError: (error) => {
        toast(error instanceof ApiError ? error.message : "Import failed", "error");
      },
    });
  }

  // Rows whose required cells are blank. Surfaced BEFORE upload because the usual cause is a
  // column the parser didn't recognise, which is invisible in a row count alone.
  const blankish = rows.filter((r) => !r.userId || !r.date).length;
  const usable = rows.length - blankish;

  if (!open) return null;

  return (
    <Sheet open onOpenChange={(next) => { if (!next) handleClose(); }}>
      <SheetContent
        onInteractOutside={(e) => { if (importer.isPending) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (importer.isPending) e.preventDefault(); }}
      >
        <SheetHeader kicker="Attendance" title="Import from Excel" />

        <SheetBody>
          {step === "choose" ? (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Upload a spreadsheet of check-in / check-out times. Imported days merge with the
                data already on the device — a punch that is already recorded is skipped, never
                duplicated, so it is safe to re-upload the same file.
              </p>

              <div className="rounded-card border border-border bg-muted/40 p-3">
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" aria-hidden />
                  <div className="flex flex-col gap-1">
                    <p className="text-[12.5px] font-semibold text-foreground">Required columns</p>
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      <strong className="font-semibold text-foreground">Employee ID</strong> ·{" "}
                      <strong className="font-semibold text-foreground">Date</strong> (YYYY-MM-DD) ·{" "}
                      <strong className="font-semibold text-foreground">Check In</strong> ·{" "}
                      <strong className="font-semibold text-foreground">Check Out</strong> (HH:mm)
                    </p>
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      Present / Late is worked out from the times against your late-arrival
                      setting, so the sheet does not carry a status column.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => void downloadAttendanceTemplate()}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download template
                </Button>
              </div>

              {parseError ? (
                <div role="alert" className="flex items-start gap-2 rounded-card border border-destructive/40 bg-destructive-soft px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-destructive-ink" aria-hidden />
                  <p className="text-[12.5px] leading-relaxed text-destructive-ink">{parseError}</p>
                </div>
              ) : null}

              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => void handleFile(e.target.files?.[0])}
                data-testid="attendance-import-file"
              />
              {/*
                FolderOpen, not an upload arrow: this button opens the OS file picker, it does
                not send anything. The upload happens later, on "Import N row(s)" — labelling
                both as upload would suggest picking a file already commits it.
              */}
              <Button onClick={() => fileInput.current?.click()}>
                <FolderOpen className="h-4 w-4" aria-hidden />
                Choose spreadsheet
              </Button>
            </div>
          ) : null}

          {step === "preview" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-semibold text-foreground">{fileName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {usable} row(s) ready
                  {blankish > 0 ? ` · ${blankish} row(s) missing an ID or date` : ""}
                </p>
              </div>

              {usable === 0 ? (
                <div role="alert" className="flex items-start gap-2 rounded-card border border-destructive/40 bg-destructive-soft px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-destructive-ink" aria-hidden />
                  <p className="text-[12.5px] leading-relaxed text-destructive-ink">
                    No usable rows. Check that the Employee ID and Date columns are filled in and
                    named as the template shows.
                  </p>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-card border border-border">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="px-3 py-2 font-semibold">Employee ID</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Check In</th>
                      <th className="px-3 py-2 font-semibold">Check Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5">{row.userId || "—"}</td>
                        <td className="px-3 py-1.5">{row.date || "—"}</td>
                        <td className="px-3 py-1.5">{row.checkIn || "—"}</td>
                        <td className="px-3 py-1.5">{row.checkOut || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length > PREVIEW_ROWS ? (
                <p className="text-[11.5px] text-muted-foreground">
                  Showing the first {PREVIEW_ROWS} of {rows.length} rows.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "result" && result ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2.5">
                {result.acceptedRows > 0 ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success-ink" aria-hidden />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-destructive-ink" aria-hidden />
                )}
                <p className="text-[13px] font-semibold leading-relaxed text-foreground">
                  {describeImportResult(result)}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-2">
                <Stat label="Rows read" value={result.acceptedRows} />
                <Stat label="New punches" value={result.inserted} />
                <Stat label="Already present" value={result.duplicates} />
                <Stat label="Days updated" value={result.reconciled} />
              </dl>

              {result.duplicates > 0 && result.inserted === 0 ? (
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Every punch in this file was already recorded, so nothing was added. This is
                  what a repeat upload looks like — your data was not duplicated.
                </p>
              ) : null}

              {result.errors.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[12.5px] font-semibold text-foreground">
                    {result.errors.length} row(s) skipped
                  </p>
                  <ul className="flex flex-col gap-1">
                    {result.errors.slice(0, MAX_LISTED_ERRORS).map((error, i) => (
                      <li key={i} className="text-[11.5px] leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">Row {error.row}:</span>{" "}
                        {error.message}
                      </li>
                    ))}
                  </ul>
                  {result.errors.length > MAX_LISTED_ERRORS ? (
                    <p className="text-[11.5px] text-muted-foreground">
                      …and {result.errors.length - MAX_LISTED_ERRORS} more.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetBody>

        <SheetFooter>
          {step === "preview" ? (
            <>
              <Button variant="outline" size="sm" onClick={reset} disabled={importer.isPending}>
                Choose another file
              </Button>
              <Button size="sm" onClick={handleImport} disabled={usable === 0 || importer.isPending}>
                {importer.isPending ? "Importing…" : `Import ${usable} row(s)`}
              </Button>
            </>
          ) : step === "result" ? (
            <>
              <Button variant="outline" size="sm" onClick={reset}>
                Import another file
              </Button>
              <Button size="sm" onClick={handleClose}>
                Done
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[17px] font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
