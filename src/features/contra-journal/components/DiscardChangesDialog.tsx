"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Discard-changes dialog for the GEN voucher editors (spec §8). */
export function DiscardChangesDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) keepRef.current?.focus();
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="voucher-discard-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogDescription className="mt-2">
          Your edits since the last save will be lost.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} data-testid="voucher-discard-keep">
            Keep editing
          </Button>
          <Button variant="destructive" size="md" onClick={onConfirm} data-testid="voucher-discard-confirm">
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
