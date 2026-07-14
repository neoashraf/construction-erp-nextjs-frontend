"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Discard-draft confirm dialog (spec §8). The non-destructive "Keep editing" is
 * default-focused (a11y §10). `busy` locks both buttons during the delete call.
 */
export function DiscardDraftDialog({
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
      <DialogContent
        data-testid="receipt-discard-dialog"
        hideClose
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-token bg-destructive-soft text-destructive-ink" aria-hidden>
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle>Discard this receipt?</DialogTitle>
            <DialogDescription className="mt-2">Your unsaved changes will be lost.</DialogDescription>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="receipt-discard-cancel">
            Keep editing
          </Button>
          <Button variant="destructive" size="md" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} data-testid="receipt-discard-confirm">
            {busy ? "Discarding…" : "Discard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
