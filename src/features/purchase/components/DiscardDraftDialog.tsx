"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Discard-changes confirm dialog (brief §Design-file-coverage — omitted from the
 * design file, built from the same dialog pattern as Approve). Shown when the editor
 * has unsaved changes and the user navigates away. "Keep editing" is default-focused
 * (non-destructive); "Discard" throws away the draft edits and returns to the list.
 */
export function DiscardDraftDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="po-discard-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="po-discard-keep"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogDescription className="mt-2">
          Your edits to this draft purchase order will be lost. This can&apos;t be undone.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            data-testid="po-discard-keep"
          >
            Keep editing
          </Button>
          <Button size="md" onClick={onDiscard} data-testid="po-discard-confirm">
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
