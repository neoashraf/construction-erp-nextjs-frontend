"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import { mapAttendanceError } from "../schemas/attendance.schema";
import { type BiometricConflict, type BiometricImportResult, type OfficeAttendanceRow } from "../api/attendance";

/**
 * Biometric-import reconciliation panel (FR-HR-004; spec §12.9). Lists each conflict with
 * "Keep manual" / "Keep imported" — never silently double a day. Resolutions post a bulk
 * `POST /attendance/office` with the chosen row. When conflicts exist the heading is
 * `role="alert"` (spec §10) so screen readers pick it up.
 */
type Resolution = "MANUAL" | "IMPORTED";

export function ReconciliationPanel({
  result,
  onResolved,
}: {
  result: BiometricImportResult;
  onResolved: () => void;
}) {
  const { toast } = useToast();
  const { saveOffice } = useAttendanceMutations();
  const [choices, setChoices] = useState<Record<string, Resolution>>({});

  const conflicts = result.conflicts;
  const hasConflicts = conflicts.length > 0;

  function keyFor(c: BiometricConflict): string {
    return `${c.employeeId}::${c.attendanceDate}`;
  }

  async function apply() {
    const rows: OfficeAttendanceRow[] = [];
    for (const c of conflicts) {
      const pick = choices[keyFor(c)];
      if (!pick) continue;
      const chosen = pick === "MANUAL" ? c.manual : c.imported;
      if (chosen) rows.push(chosen);
    }
    if (rows.length === 0) {
      toast("Choose Keep manual or Keep imported for each conflict.", "error");
      return;
    }
    try {
      await saveOffice.mutateAsync(rows);
      toast(`Reconciled ${rows.length} conflict${rows.length === 1 ? "" : "s"}.`, "success");
      onResolved();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      toast(mapAttendanceError(String(code)), "error");
    }
  }

  return (
    <div data-testid="reconciliation-panel" className="rounded-card border border-border bg-surface-2 p-3">
      <h4
        className="text-[12.5px] font-bold text-foreground"
        role={hasConflicts ? "alert" : undefined}
        data-testid="reconciliation-heading"
      >
        {hasConflicts
          ? `${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} to reconcile`
          : `Imported ${result.imported}, reconciled ${result.reconciled}. No conflicts.`}
      </h4>
      {!hasConflicts && (
        <Alert tone="success" className="mt-2" title="Import complete." />
      )}
      {hasConflicts && (
        <ul className="mt-2 flex flex-col divide-y divide-border" data-testid="reconciliation-list">
          {conflicts.map((c) => {
            const k = keyFor(c);
            const choice = choices[k];
            return (
              <li key={k} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="reconciliation-item">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground">
                    {c.employeeId} · {c.attendanceDate}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">{c.reason}</div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={choice === "MANUAL" ? "primary" : "outline"}
                    onClick={() => setChoices((s) => ({ ...s, [k]: "MANUAL" }))}
                    data-testid={`keep-manual-${c.employeeId}`}
                  >
                    Keep manual
                  </Button>
                  <Button
                    size="sm"
                    variant={choice === "IMPORTED" ? "primary" : "outline"}
                    onClick={() => setChoices((s) => ({ ...s, [k]: "IMPORTED" }))}
                    data-testid={`keep-imported-${c.employeeId}`}
                  >
                    Keep imported
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasConflicts && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={apply}
            disabled={saveOffice.isPending}
            data-testid="reconciliation-apply"
          >
            {saveOffice.isPending ? "Saving…" : "Save resolutions"}
          </Button>
        </div>
      )}
    </div>
  );
}
