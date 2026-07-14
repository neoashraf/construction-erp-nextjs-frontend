"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Cancel confirm dialog (spec §7/§8; design "Cancel dialog"). Reverses a POSTED
 * receipt — LED writes a reversal entry, the original number is retained
 * (FR-REC-021/-022/-023). A reason is mandatory; the non-destructive "Keep it" is
 * default-focused (a11y §10). `busy` locks both buttons during the server call.
 */
export function CancelReceiptDialog({
  open,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      keepRef.current?.focus();
    }
  }, [open]);

  function confirm() {
    if (!reason.trim()) {
      setError("Enter a reason for cancelling this receipt.");
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="receipt-cancel-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Cancel this receipt?</DialogTitle>
        <DialogDescription className="mt-2">
          This reverses the posted ledger entry. The original receipt number is retained; the
          reversal takes its own number. Any IPC outstanding this receipt reduced will be restored.
          This can&apos;t be undone.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="receipt-cancel-reason">Reason</Label>
          <Textarea
            id="receipt-cancel-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            aria-describedby={error ? "receipt-cancel-reason-err" : undefined}
            placeholder="Why is this receipt being cancelled?"
            data-testid="receipt-cancel-reason"
          />
          {error && (
            <p
              id="receipt-cancel-reason-err"
              role="alert"
              className="text-[12px] font-medium text-destructive"
              data-testid="receipt-cancel-reason-err"
            >
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            ref={keepRef}
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={busy}
            data-testid="receipt-cancel-keep"
          >
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={confirm}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="receipt-cancel-confirm"
          >
            {busy ? "Cancelling…" : "Cancel receipt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
