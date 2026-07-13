"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { reverseReasonSchema } from "../schemas/stock-journal.schema";

/**
 * Reverse confirm dialog (FR-INV-020; spec §8/§9). A POSTED journal is immutable — Reverse
 * appends a correcting (CANCELLED) record with mirror movements + a LED reversal, never an
 * edit. Always confirm-gated with a MANDATORY reason (API `reason`). Radix Dialog traps
 * focus + returns it to the trigger on close. The Editor owns the mutation + error map.
 */
export function ReverseDialog({
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function confirm() {
    const parsed = reverseReasonSchema.safeParse({ reason });
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message ?? "Enter a reason for reversing this Stock Journal.");
      return;
    }
    setReasonError(null);
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose data-testid="sj-reverse-dialog">
        <DialogTitle>Reverse this Stock Journal?</DialogTitle>
        <DialogDescription className="mt-2">
          This will restore the prior stock balances and reverse any related ledger entry. The original record is kept
          for audit. This can&apos;t be undone.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="sj-reverse-reason">Reason</Label>
          <Textarea
            id="sj-reverse-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            invalid={!!reasonError}
            data-testid="sj-reverse-reason"
          />
          {reasonError && <p className="text-[11.5px] text-destructive-ink" data-testid="sj-reverse-reason-error">{reasonError}</p>}
        </div>

        {error && (
          <p className="mt-3 rounded-card border border-destructive-soft bg-destructive-soft px-3 py-2 text-[12px] text-destructive-ink" data-testid="sj-reverse-error">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onClose} disabled={pending}>
            Keep as posted
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={confirm}
            disabled={pending}
            aria-busy={pending || undefined}
            data-testid="sj-reverse-confirm"
          >
            {pending ? "Reversing…" : "Reverse"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
