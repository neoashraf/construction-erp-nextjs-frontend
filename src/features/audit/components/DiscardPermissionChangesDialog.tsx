"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Discard-unsaved-permission-edits confirm (spec §8 exact copy). */
export function DiscardPermissionChangesDialog({
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
      <DialogContent hideClose data-testid="discard-permission-dialog">
        <DialogTitle>Discard your changes?</DialogTitle>
        <DialogDescription className="mt-2">
          Unsaved permission changes will be lost.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={onKeepEditing}
            data-testid="keep-editing-permissions"
          >
            Keep editing
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={onDiscard}
            data-testid="discard-permissions-confirm"
          >
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
