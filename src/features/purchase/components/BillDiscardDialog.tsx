"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Discard-draft dialog for a DRAFT purchase bill (brief §Design-file-coverage — the
 * design file omits this state; built from the same dialog pattern as Post/Cancel).
 * "Keep editing" is default-focused (non-destructive); "Discard" throws away the
 * unsaved edits (or hard-deletes an unsaved DRAFT) and returns to the list. Named
 * `BillDiscardDialog` to avoid collision with the sibling PO `DiscardDraftDialog`.
 */
export function BillDiscardDialog({
  open,
  busy,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="bill-discard-dialog"
        role="alertdialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="bill-discard-keep"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogDescription className="mt-2">
          Your unsaved changes will be lost. This can&apos;t be undone.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="bill-discard-keep"
          >
            Keep editing
          </Button>
          <Button
            size="md"
            onClick={onDiscard}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="bill-discard-confirm"
          >
            {busy ? "Discarding…" : "Discard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
