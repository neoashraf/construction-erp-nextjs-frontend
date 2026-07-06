"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Bulk-clear warning (spec §8/§13). A bulk clear that removes grants carrying value
 * limits confirms first, mirroring the single-toggle limit-removal warning.
 */
export function BulkClearWarningDialog({
  open,
  count,
  limited,
  onKeep,
  onClear,
}: {
  open: boolean;
  count: number;
  limited: number;
  onKeep: () => void;
  onClear: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onKeep()}>
      <DialogContent hideClose data-testid="bulk-clear-dialog">
        <DialogTitle>Clear these permissions?</DialogTitle>
        <DialogDescription className="mt-2">
          Clearing removes {count} grant{count === 1 ? "" : "s"}, including {limited} with value limit
          {limited === 1 ? "" : "s"}.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onKeep} data-testid="bulk-clear-keep">
            Keep
          </Button>
          <Button variant="destructive" size="md" onClick={onClear} data-testid="bulk-clear-confirm">
            Clear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
