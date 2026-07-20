"use client";

import { useEffect, useRef, useState } from "react";
import { Check, UploadCloud, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCaptureAttendance } from "../access";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import { useProjectOptions } from "../hooks/useProjectOptions";
import { parseAttendanceFeed } from "../lib/parseAttendanceFeed";
import { mapAttendanceError } from "../schemas/attendance.schema";
import {
  type BiometricConflict,
  type BiometricImportResult,
  type BiometricFeedRow,
} from "../api/attendance";

/**
 * Biometric CSV/XLSX (or device-feed) import drawer (FR-HR-004; Attendance.dc.html
 * §Import/Reconciliation side panel). Pick the project the feed belongs to, drop/paste a feed
 * of `{ employeeCode, attendanceDate, checkIn?, checkOut?, dayStatus? }`, and hit "Import". The
 * server resolves each employeeCode, applies the chosen project to every row, inserts the
 * non-conflicting rows (append-only — never doubles a day), and returns
 * `{ imported, reconciled, conflicts[] }`. Conflicts (unknown code / day already recorded) are
 * shown as a skipped-rows summary — informational; the operator fixes the source and re-imports.
 *
 * Rendered via the shared `Sheet` primitive — dim backdrop, focus-trap, Esc/scrim close,
 * scroll-lock (design-system §Right drawer / slide-over). Opened by the "Biometric import"
 * entry-source toggle on the office roster; the header shows the project · date scope. At ≥360
 * the body shows a "Best done on a larger screen" note (spec §4).
 */
export function BiometricImportPanel({
  open,
  onOpenChange,
  projectId,
  projectLabel,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The roster's selected project — the default import project (applied to every row). */
  projectId?: string;
  /** Human-readable project name (or "All assigned projects") for the header subtitle. */
  projectLabel: string;
  /** ISO date (YYYY-MM-DD) the import is scoped to. */
  date: string;
}) {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const { toast } = useToast();
  const { importOffice } = useAttendanceMutations();
  const projectsQ = useProjectOptions();
  const projects = projectsQ.data ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [raw, setRaw] = useState<string>("");
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<BiometricImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The project every imported row lands in. Defaults to the roster's filter selection but is
  // editable here so the import doesn't depend on the operator having Applied the filter.
  const [importProjectId, setImportProjectId] = useState<string>(projectId ?? "");
  useEffect(() => {
    if (projectId) setImportProjectId(projectId);
  }, [projectId]);

  const conflicts = result?.conflicts ?? [];
  const hasConflicts = conflicts.length > 0;

  function conflictKey(c: BiometricConflict): string {
    return `${c.employeeId}::${c.attendanceDate}`;
  }

  function reset() {
    setRaw("");
    setFileMeta(null);
    setResult(null);
    setError(null);
  }

  function close() {
    onOpenChange(false);
  }

  async function submit() {
    setError(null);
    if (!importProjectId) {
      setError("Choose the project for this import — every row is imported into it.");
      return;
    }
    let feed: BiometricFeedRow[];
    try {
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) throw new Error("expected an array");
      feed = parsed as BiometricFeedRow[];
    } catch {
      setError("Drop a CSV/XLSX file or paste a JSON array of rows.");
      return;
    }
    try {
      const res = await importOffice.mutateAsync({ projectId: importProjectId, feed });
      setResult(res);
      toast(`Imported ${res.reconciled} of ${res.imported} row${res.imported === 1 ? "" : "s"}.`, "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      setError(mapAttendanceError(String(code)));
    }
  }

  async function onFile(file: File) {
    setError(null);
    try {
      const rows = await parseAttendanceFeed(file);
      // Show the parsed rows as JSON so the user can review/edit before importing.
      setRaw(JSON.stringify(rows, null, 2));
      setFileMeta({ name: file.name, size: file.size });
    } catch (e) {
      setRaw("");
      setFileMeta(null);
      setError(
        e instanceof Error ? e.message : "Couldn't read that file. Upload a CSV, XLSX, or JSON file.",
      );
    }
  }

  if (!canCapture) {
    return null;
  }

  const fileSizeKb = fileMeta ? `${Math.max(1, Math.round(fileMeta.size / 1024))} KB` : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        className="w-[404px] max-w-full"
        data-testid="biometric-import-panel"
        aria-label="Import biometric attendance"
        aria-describedby={undefined}
      >
        {/* Header — title + project · date scope */}
        <div className="flex flex-none items-center gap-2.5 border-b border-border px-[18px] py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-foreground">Import biometric attendance</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {projectLabel} · <span className="font-mono">{date ? formatDate(date) : "—"}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="grid h-[30px] w-[30px] flex-none place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="biometric-close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
          <p className="text-[11.5px] text-muted-foreground sm:hidden" data-testid="biometric-mobile-note">
            Best done on a larger screen.
          </p>

          {/* Project — every imported row lands here (required by the server) */}
          <div>
            <label
              htmlFor="biometric-project"
              className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground"
            >
              Project<span className="text-destructive">*</span>
            </label>
            <Select
              id="biometric-project"
              value={importProjectId}
              onChange={(e) => {
                setImportProjectId(e.target.value);
                setError(null);
              }}
              invalid={!!error && !importProjectId}
              disabled={projectsQ.isLoading}
              data-testid="biometric-project"
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-faint">Every row in the file is imported into this project.</p>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-card border-[1.5px] border-dashed border-border-strong bg-surface-2 px-4 py-[22px] text-center transition-colors",
              dragOver && "border-accent bg-accent-soft",
            )}
            data-testid="biometric-dropzone"
          >
            <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-muted text-muted-foreground">
              <UploadCloud className="h-[17px] w-[17px]" aria-hidden />
            </span>
            <span className="text-[13px] font-medium text-foreground">
              Drag a CSV or XLSX file here, or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-semibold text-accent-ink hover:underline"
                data-testid="biometric-browse"
              >
                browse
              </button>
              .
            </span>
            {fileMeta ? (
              <span className="font-mono text-[11px] text-faint" data-testid="biometric-filename">
                {fileMeta.name} · {fileSizeKb}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-faint">CSV, XLSX or a JSON feed</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
              data-testid="biometric-file"
            />
          </div>

          {/* Paste-JSON fallback / parsed-feed preview */}
          <textarea
            className="h-20 w-full rounded-token border border-border-strong bg-background p-2 font-mono text-[11.5px] text-foreground focus:border-accent focus:outline-none focus:shadow-focus"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (fileMeta) setFileMeta(null);
            }}
            placeholder='Or paste JSON — [ { "employeeCode": "1", "attendanceDate": "2026-07-13", "checkIn": "09:15", "checkOut": "18:00", "dayStatus": "PRESENT" } ]'
            aria-label="Biometric feed JSON"
            data-testid="biometric-json"
          />

          {error && <Alert tone="destructive" title={error} data-testid="biometric-error" />}

          {/* Result — success banner + skipped-conflicts summary */}
          {result && (
            <div
              className="flex gap-2.5 rounded-card border border-success/40 bg-success-soft px-3 py-2.5"
              data-testid="biometric-summary"
            >
              <Check className="mt-px h-3.5 w-3.5 flex-none text-success-ink" strokeWidth={2.2} aria-hidden />
              <span
                className="text-[12.5px] font-medium leading-[1.5] text-success-ink"
                data-testid="biometric-summary-text"
              >
                Imported {result.reconciled} of {result.imported} row{result.imported === 1 ? "" : "s"}
                {hasConflicts ? ` — ${conflicts.length} skipped.` : "."}
              </span>
            </div>
          )}

          {result && hasConflicts && (
            <div>
              <div className="flex flex-col items-start gap-1.5">
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-pill bg-warning-soft px-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
                  <span
                    className="text-[11.5px] font-semibold text-warning-ink"
                    role="alert"
                    data-testid="biometric-conflict-count"
                  >
                    {conflicts.length} row{conflicts.length === 1 ? "" : "s"} skipped
                  </span>
                </span>
                <span className="text-[11.5px] leading-[1.4] text-faint">
                  The system never silently doubles a day. Fix the source and re-import.
                </span>
              </div>
              <div className="mt-[11px] flex flex-col gap-2.5" data-testid="biometric-conflict-list">
                {conflicts.map((c) => (
                  <div
                    key={conflictKey(c)}
                    className="rounded-card border border-border bg-surface p-[13px]"
                    data-testid="biometric-conflict"
                  >
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
                        {c.employeeId}
                      </span>
                      <span className="text-border-strong" aria-hidden>—</span>
                      <span className="font-mono text-[12px] text-muted-foreground">{formatDate(c.attendanceDate)}</span>
                    </div>
                    <div className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">
                      {mapAttendanceError(c.reason, c.reason)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — pinned. Before import: Cancel + Import. After import: Close + Import another. */}
        <div className="flex flex-none items-center justify-end gap-2.5 border-t border-border px-[18px] py-3">
          <Button variant="ghost" size="md" onClick={close} data-testid="biometric-cancel">
            {result ? "Close" : "Cancel"}
          </Button>
          <Button
            size="md"
            onClick={result ? reset : submit}
            disabled={result ? false : importOffice.isPending || raw.trim() === ""}
            data-testid={result ? "biometric-import-another" : "biometric-import"}
          >
            {result ? "Import another" : importOffice.isPending ? "Importing…" : "Import"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
