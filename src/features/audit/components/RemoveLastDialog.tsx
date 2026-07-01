"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Remove-last-project confirm dialog (spec §6/§8/§9; SRS §12 edge 14). Removing
 * the last project from a scoped user is allowed but gated here because it
 * disables the user's ability to transact until re-assigned. Radix Dialog traps
 * focus and returns it to the trigger on close (spec §10).
 */
export function RemoveLastDialog({
  open,
  userName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  userName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent hideClose data-testid="remove-last-dialog">
        <DialogTitle>Remove the last project?</DialogTitle>
        <DialogDescription className="mt-2">
          {userName} will have no projects and won&rsquo;t be able to transact until you assign one.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onCancel} data-testid="remove-last-cancel">
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={onConfirm}
            data-testid="remove-last-confirm"
          >
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
