"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Cancel confirm dialog (spec §7/§8). Mandatory reason. Non-destructive "Keep it" is
 * default-focused (a11y §10). `busy` locks both buttons during the atomic server call.
 */
export function CancelPaymentDialog({
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
      setError("Enter a reason for cancelling this payment.");
      return;
    }
    onConfirm(reason.trim());
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="payment-cancel-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Cancel this payment?</DialogTitle>
        <DialogDescription className="mt-2">
          This reverses the posted ledger entry. The original payment number is retained; the
          reversal takes its own number. Each settled payable&apos;s outstanding rises back.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="pay-cancel-reason">Reason</Label>
          <Textarea
            id="pay-cancel-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            placeholder="Why is this payment being cancelled?"
            data-testid="payment-cancel-reason"
          />
          {error && (
            <p role="alert" className="text-[12px] font-medium text-destructive" data-testid="payment-cancel-reason-err">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="payment-cancel-keep">
            Keep it
          </Button>
          <Button variant="destructive" size="md" onClick={confirm} disabled={busy} aria-busy={busy || undefined} data-testid="payment-cancel-confirm">
            {busy ? "Cancelling…" : "Cancel payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
