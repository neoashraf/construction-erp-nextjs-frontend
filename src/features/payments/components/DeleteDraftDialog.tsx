"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Delete-draft confirm dialog (spec §8). The non-destructive "Keep it" is
 * default-focused (a11y §10). `busy` locks both buttons during the delete call.
 */
export function DeleteDraftDialog({
  open,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) keepRef.current?.focus();
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="payment-delete-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-token bg-destructive-soft text-destructive-ink" aria-hidden>
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle>Delete this draft payment?</DialogTitle>
            <DialogDescription className="mt-2">
              A draft carries no legal number and no ledger impact — deleting it is permanent.
            </DialogDescription>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="payment-delete-keep">
            Keep it
          </Button>
          <Button variant="destructive" size="md" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} data-testid="payment-delete-confirm">
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
