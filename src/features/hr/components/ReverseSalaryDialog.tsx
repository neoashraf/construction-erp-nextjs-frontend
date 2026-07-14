"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { reverseSalarySchema } from "../schemas/salary.schema";

/**
 * Reverse salary dialog (spec §7/§8; FR-HR-018). Mandatory reason textarea; the reason is
 * recorded on the reversal entry and audit log. On success the sheet flips REVERSED, the
 * lines table stays visible (audit) but read-only, and a "Reversed by {reversalEntryNo}"
 * link appears next to the original `entryNo` (the original stays untouched — append-only
 * ledger, CLAUDE.md non-negotiable 4).
 */
export function ReverseSalaryDialog({
  open,
  onOpenChange,
  entryNo,
  onReverse,
  isReversing,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entryNo: string | null;
  onReverse: (reason: string) => void;
  isReversing: boolean;
  errorMessage?: string | null;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  function submit() {
    const parsed = reverseSalarySchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a reason for reversing this salary run.");
      return;
    }
    setError(null);
    onReverse(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!isReversing ? onOpenChange(v) : undefined)}>
      <DialogContent data-testid="reverse-salary-dialog">
        <DialogTitle>Reverse this salary run?</DialogTitle>
        <DialogDescription>
          This posts a reversing entry against {entryNo ? <span className="font-mono">{entryNo}</span> : "this run"}.
          The original stays on record; a corrected sheet can be generated fresh.
        </DialogDescription>

        <div className="mt-4">
          <Label htmlFor="rev-reason" className="mb-1 block text-[12px] font-semibold text-foreground">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="rev-reason"
            data-testid="rev-reason"
            aria-describedby={error ? "rev-reason-err" : undefined}
            value={reason}
            invalid={!!error}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. TDS applied to the wrong staff group."
          />
          {error && (
            <p id="rev-reason-err" className="mt-1 text-[12px] text-destructive" data-testid="rev-reason-err">
              {error}
            </p>
          )}
        </div>

        {errorMessage && (
          <Alert tone="destructive" className="mt-4" title={errorMessage} data-testid="rev-server-err" />
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReversing} data-testid="rev-cancel">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={isReversing}
            data-testid="rev-confirm"
            aria-busy={isReversing || undefined}
          >
            {isReversing ? "Reversing…" : "Reverse"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
