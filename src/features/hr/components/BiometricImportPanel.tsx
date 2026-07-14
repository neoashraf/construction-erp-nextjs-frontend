"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCaptureAttendance } from "../access";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import { mapAttendanceError } from "../schemas/attendance.schema";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { type BiometricImportResult, type OfficeAttendanceRow } from "../api/attendance";

/**
 * Biometric CSV/XLSX (or device-feed) import panel (FR-HR-004). Drop or paste a JSON list
 * of `{ employeeId, attendanceDate, dayStatus, checkIn?, checkOut?, projectId }` and hit
 * "Import". The server returns `{ imported, reconciled, conflicts[] }` — conflicts open
 * the reconciliation panel with "Keep manual" / "Keep imported" options (never silently
 * double a day). At ≥360 the panel shows a "Best done on a larger screen" note (spec §4).
 * Rendered as a right-side overlay panel toggled by the "Biometric import" entry-source
 * button on the office roster (Attendance.dc.html) — `onClose` returns to Manual entry.
 */
export function BiometricImportPanel({ onClose }: { onClose?: () => void }) {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const { toast } = useToast();
  const { importOffice } = useAttendanceMutations();

  const [raw, setRaw] = useState<string>("");
  const [result, setResult] = useState<BiometricImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    let feed: OfficeAttendanceRow[];
    try {
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) throw new Error("expected an array");
      feed = parsed as OfficeAttendanceRow[];
    } catch {
      setError("Paste a JSON array of rows or drop a CSV/XLSX file.");
      return;
    }
    try {
      const res = await importOffice.mutateAsync(feed);
      setResult(res);
      toast(`Imported ${res.imported} row${res.imported === 1 ? "" : "s"}.`, "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      setError(mapAttendanceError(String(code)));
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    setRaw(text);
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
            placeholder='[ { "employeeId": "emp-1", "attendanceDate": "2026-07-13", "dayStatus": "PRESENT", "projectId": "proj-a" } ]'
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
