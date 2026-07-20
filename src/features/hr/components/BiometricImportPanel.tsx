"use client";

import { useEffect, useState } from "react";
import { Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCaptureAttendance } from "../access";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import { useProjectOptions } from "../hooks/useProjectOptions";
import { parseAttendanceFeed } from "../lib/parseAttendanceFeed";
import { mapAttendanceError } from "../schemas/attendance.schema";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { type BiometricImportResult, type BiometricFeedRow } from "../api/attendance";

/**
 * Biometric CSV/XLSX (or device-feed) import panel (FR-HR-004). Pick the project the feed
 * belongs to, then drop/paste a feed of `{ employeeCode, attendanceDate, checkIn?, checkOut?,
 * dayStatus? }` and hit "Import". The server resolves each employeeCode, applies the chosen
 * project to every row, inserts the non-conflicting rows, and returns
 * `{ imported, reconciled, conflicts[] }` — conflicts (unknown code / already recorded) are
 * shown as a summary (never silently doubles a day). The project defaults to the roster's
 * filter selection but can be changed here so the import is self-contained. At ≥360 the panel
 * shows a "Best done on a larger screen" note (spec §4). Rendered as a right-side overlay
 * toggled by the "Biometric import" entry-source button — `onClose` returns to Manual entry.
 */
export function BiometricImportPanel({
  projectId,
  onClose,
}: {
  /** The roster's selected project — applied to every imported row (required by the server). */
  projectId?: string;
  onClose?: () => void;
}) {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const { toast } = useToast();
  const { importOffice } = useAttendanceMutations();
  const projectsQ = useProjectOptions();
  const projects = projectsQ.data ?? [];

  const [raw, setRaw] = useState<string>("");
  const [result, setResult] = useState<BiometricImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The project every imported row lands in. Defaults to the roster's filter selection but is
  // editable here so the import doesn't depend on the operator having Applied the filter.
  const [importProjectId, setImportProjectId] = useState<string>(projectId ?? "");
  useEffect(() => {
    if (projectId) setImportProjectId(projectId);
  }, [projectId]);

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
      setError("Paste a JSON array of rows or drop a CSV/XLSX file.");
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
    } catch (e) {
      setRaw("");
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't read that file. Upload a CSV, XLSX, or JSON file.",
      );
    }
  }

  if (!canCapture) {
    return null;
  }

  return (
    <Card
      className="flex h-full flex-col overflow-hidden rounded-none border-y-0 border-r-0 shadow-lg"
      data-testid="biometric-import-panel"
    >
      <div className="flex flex-none items-center gap-2.5 border-b border-border px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-foreground">Import biometric attendance</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">CSV/XLSX or a device-API feed.</p>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-[30px] w-[30px] flex-none place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        <p className="text-[11.5px] text-muted-foreground sm:hidden" data-testid="biometric-mobile-note">
          Best done on a larger screen.
        </p>

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

        <div className="rounded-token border border-dashed border-border-strong p-3">
          <label htmlFor="biometric-file" className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Drop a file or paste JSON
          </label>
          <Input
            id="biometric-file"
            type="file"
            accept=".csv,.xlsx,.json,application/json"
            className="text-[12px]"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
            data-testid="biometric-file"
          />
          <textarea
            className="mt-2 h-24 w-full rounded-token border border-border-strong bg-background p-2 font-mono text-[11.5px] text-foreground focus:border-accent focus:outline-none focus:shadow-focus"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='[ { "employeeCode": "1", "attendanceDate": "2026-07-13", "checkIn": "09:15", "checkOut": "18:00", "dayStatus": "PRESENT" } ]'
            aria-label="Biometric feed JSON"
            data-testid="biometric-json"
          />
        </div>

        {error && <Alert tone="destructive" title={error} data-testid="biometric-error" />}

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={submit}
            disabled={importOffice.isPending || raw.trim() === ""}
            data-testid="biometric-import"
          >
            {importOffice.isPending ? "Importing…" : "Import"}
          </Button>
        </div>

        {result && (
          <ReconciliationPanel
            result={result}
            onResolved={() => setResult(null)}
          />
        )}
      </div>
    </Card>
  );
}
