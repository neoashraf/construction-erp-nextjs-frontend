"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Cancel confirm dialog (spec §8; built from the design-system dialog defaults — the design
 * file omits this state). Reverses a POSTED IPC: LED writes a reversal entry, the original
 * number is retained (FR-SAL-021/-022). A reason is mandatory; the non-destructive "Keep it"
 * is default-focused (a11y §10). `busy` locks both buttons during the server call.
 */
export function CancelDialog({
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
      setError("Enter a reason for cancelling this IPC.");
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="ipc-cancel-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Cancel this IPC?</DialogTitle>
        <DialogDescription className="mt-2">
          This reverses the posted ledger entry. The original IPC number is retained; the reversal takes its own
          number. This can&apos;t be undone.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="ipc-cancel-reason">Reason</Label>
          <Textarea
            id="ipc-cancel-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            aria-describedby={error ? "ipc-cancel-reason-err" : undefined}
            placeholder="Why is this IPC being cancelled?"
            data-testid="ipc-cancel-reason"
          />
          {error && (
            <p id="ipc-cancel-reason-err" className="text-[12px] font-medium text-destructive" data-testid="ipc-cancel-reason-err">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="ipc-cancel-keep">
            Keep it
          </Button>
          <Button variant="destructive" size="md" onClick={confirm} disabled={busy} aria-busy={busy || undefined} data-testid="ipc-cancel-confirm">
            {busy ? "Cancelling…" : "Cancel IPC"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
