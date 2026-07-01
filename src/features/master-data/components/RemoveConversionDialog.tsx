"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/toast";
import { type ItemUomConversion } from "../types";
import { useRemoveConversion } from "../hooks/useUomConversions";

/** Remove-conversion confirm (FR-MAS-026). REFERENCED_MASTER → in-use message. */
export function RemoveConversionDialog({
  itemId,
  conversion,
  baseUom,
  onClose,
}: {
  itemId: string;
  conversion: ItemUomConversion | null;
  baseUom: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const remove = useRemoveConversion(itemId);

  function confirm() {
    if (!conversion) return;
    remove.mutate(conversion.id, {
      onSuccess: () => {
        toast(`Unit ${conversion.uom} removed.`, "success");
        onClose();
      },
      onError: (err) => {
        const e = asApiError(err);
        if (e.code === "REFERENCED_MASTER") {
          toast("This unit is in use and can't be removed.", "error");
        } else if (e.code === "NETWORK_ERROR") {
          toast("You're offline. Try again when reconnected.", "error");
        } else {
          toast(e.message || "Couldn't remove the unit.", "error");
        }
        onClose();
      },
    });
  }

  return (
    <Dialog open={conversion !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose data-testid="remove-conversion-dialog">
        <DialogTitle>Remove this unit?</DialogTitle>
        <DialogDescription className="mt-2">
          Remove the conversion “1 {conversion?.uom} = {conversion?.factorToBase} {baseUom}”.
          Postings that already used it are unaffected.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={confirm}
            disabled={remove.isPending}
            data-testid="remove-conversion-confirm"
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
