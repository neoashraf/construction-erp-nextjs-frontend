"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { type AttendanceRecord } from "../api/attendance";
import { reverseAccrualSchema } from "../schemas/attendance.schema";

/**
 * Reverse-accrual dialog (FR-HR-012). Mandatory reason textarea. On success the original
 * row keeps its locked styling and gains a "Reversed" badge linked to the reversal entry;
 * the original is never edited or deleted (append-only ledger — CLAUDE.md non-negotiable 4).
 */
export function ReverseAccrualDialog({
  open,
  onOpenChange,
  row,
  onReverse,
  isReversing,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: AttendanceRecord | null;
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
    const parsed = reverseAccrualSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a reason for reversing this accrual.");
      return;
    }
    setError(null);
    onReverse(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!isReversing ? onOpenChange(v) : undefined)}>
      <DialogContent data-testid="reverse-accrual-dialog">
        <DialogTitle>Reverse accrual</DialogTitle>
        <DialogDescription>
          The original entry {row?.entryNo ? <span className="font-mono">{row.entryNo}</span> : null} stays intact — a
          linked reversal entry will be posted. Enter a reason for audit.
        </DialogDescription>

        <div className="mt-4">
          <Label htmlFor="reverse-reason" className="mb-1 block text-[12px] font-semibold text-foreground">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reverse-reason"
            data-testid="reverse-reason"
            value={reason}
            invalid={!!error}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Head-count captured against the wrong cost centre."
          />
          {error && (
            <p className="mt-1 text-[12px] text-destructive" data-testid="reverse-reason-err">
              {error}
            </p>
          )}
        </div>

        {errorMessage && (
          <Alert tone="destructive" className="mt-4" title={errorMessage} data-testid="reverse-server-err" />
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isReversing}
            data-testid="reverse-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={isReversing}
            data-testid="reverse-confirm"
            aria-busy={isReversing || undefined}
          >
            {isReversing ? "Reversing…" : "Reverse"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
