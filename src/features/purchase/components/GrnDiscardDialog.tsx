"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Discard-changes dialog (spec §8). Modal with the safe "Keep editing"
 * default-focused; "Discard" is destructive-tone.
 */
export function GrnDiscardDialog({
  open,
  busy,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="grn-discard-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="grn-discard-keep"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogDescription className="mt-2">
          Your unsaved changes will be lost.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="grn-discard-keep"
          >
            Keep editing
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={onDiscard}
            disabled={busy}
            data-testid="grn-discard-confirm"
          >
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
