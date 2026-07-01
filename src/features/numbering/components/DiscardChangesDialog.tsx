"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Discard-unsaved-changes confirm (spec §8). Shown when the Admin cancels the editor
 * with dirty prefix/padding edits. "Keep editing" returns to the form; "Discard"
 * drops the edits and closes.
 */
export function DiscardChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onKeepEditing()}>
      <DialogContent hideClose data-testid="discard-changes-dialog">
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogDescription className="mt-2">
          Your unsaved changes will be lost.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onKeepEditing} data-testid="keep-editing">
            Keep editing
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={onDiscard}
            data-testid="discard-confirm"
          >
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
