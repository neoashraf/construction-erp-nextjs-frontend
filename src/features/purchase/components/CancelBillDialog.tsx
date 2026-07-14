"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cancelBillSchema } from "../schemas/bill.schema";

/**
 * Cancel-Bill confirm dialog (brief §Scope 10; spec §8; FR-PUR-022). Mandatory non-empty
 * reason (zod-validated on submit). Default focus is on the non-destructive "Keep bill"
 * button. A server-side `409 BILL_HAS_APPLIED_PAYMENTS` closes the dialog and surfaces
 * the exact inline banner in the viewer.
 */
export function CancelBillDialog({
  open,
  busy,
  entryNo,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  entryNo: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
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
    const parsed = cancelBillSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a reason for this cancellation.");
      return;
    }
    setError(null);
    onConfirm(parsed.data.reason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="bill-cancel-dialog"
        role="alertdialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="bill-cancel-keep"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Cancel this posted bill?</DialogTitle>
        <DialogDescription className="mt-2">
          This reverses the ledger entry and the inventory receipt. The original number{" "}
          {entryNo ? <strong>{entryNo}</strong> : "on this bill"} is kept on the reversed bill.
          This can&apos;t be undone.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="bill-cancel-reason">Reason</Label>
          <Textarea
            id="bill-cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            data-testid="bill-cancel-reason"
          />
          {error && (
            <p className="text-[12px] text-destructive-ink" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="bill-cancel-keep"
          >
            Keep bill
          </Button>
          <Button
            size="md"
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="bill-cancel-confirm"
          >
            {busy ? "Cancelling…" : "Cancel bill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
