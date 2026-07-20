"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { mapAttendanceError } from "../schemas/attendance.schema";
import { type BiometricConflict, type BiometricImportResult } from "../api/attendance";

/**
 * Biometric-import result summary (FR-HR-004; spec §12.9). The server imports the
 * non-conflicting rows directly (append-only — it never doubles a day) and reports what it
 * could NOT place: an unknown employee code, or a day that already has an office row. This is
 * informational — the operator fixes the source (add the employee / correct the day) and
 * re-imports; there is nothing to post from here. When conflicts exist the heading is
 * `role="alert"` (spec §10) so screen readers pick it up.
 */
export function ReconciliationPanel({
  result,
  onResolved,
}: {
  result: BiometricImportResult;
  onResolved: () => void;
}) {
  const conflicts = result.conflicts;
  const hasConflicts = conflicts.length > 0;

  function keyFor(c: BiometricConflict): string {
    return `${c.employeeId}::${c.attendanceDate}`;
  }

  return (
    <div data-testid="reconciliation-panel" className="rounded-card border border-border bg-surface-2 p-3">
      <h4
        className="text-[12.5px] font-bold text-foreground"
        role={hasConflicts ? "alert" : undefined}
        data-testid="reconciliation-heading"
      >
        {hasConflicts
          ? `Imported ${result.reconciled} of ${result.imported}. ${conflicts.length} row${conflicts.length === 1 ? "" : "s"} skipped.`
          : `Imported ${result.reconciled} of ${result.imported}. No conflicts.`}
      </h4>

      {!hasConflicts ? (
        <Alert tone="success" className="mt-2" title="Import complete." />
      ) : (
        <>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            These rows weren&apos;t imported. Fix the source and re-import — nothing was doubled.
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-border" data-testid="reconciliation-list">
            {conflicts.map((c) => (
              <li
                key={keyFor(c)}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
                data-testid="reconciliation-item"
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground">
                    {c.employeeId} · {c.attendanceDate}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {mapAttendanceError(c.reason, c.reason)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={onResolved} data-testid="reconciliation-done">
          Done
        </Button>
      </div>
    </div>
  );
}
