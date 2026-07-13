"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cancelPoSchema } from "../schemas/order.schema";

/**
 * Cancel-PO confirm dialog (brief §Scope 8; spec §8; FR-PUR-002). Mandatory non-empty
 * reason (zod-validated on submit). Default focus is on the non-destructive "Keep PO"
 * button per §Scope 13 a11y rule. A server-side `409 PO_HAS_BILLS` closes the dialog
 * and surfaces the exact inline banner in the editor — this dialog does not display it.
 */
export function CancelPoDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
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
    const parsed = cancelPoSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a reason for the cancellation.");
      return;
    }
    setError(null);
    onConfirm(parsed.data.reason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="po-cancel-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="po-cancel-keep"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Cancel this purchase order?</DialogTitle>
        <DialogDescription className="mt-2">
          Cancellation is a hard stop — the PO can&apos;t be reused. Record why you&apos;re cancelling
          so the audit trail is meaningful.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="po-cancel-reason">Reason</Label>
          <Textarea
            id="po-cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            data-testid="po-cancel-reason"
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
            data-testid="po-cancel-keep"
          >
            Keep PO
          </Button>
          <Button
            size="md"
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="po-cancel-confirm"
          >
            {busy ? "Cancelling…" : "Cancel PO"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
