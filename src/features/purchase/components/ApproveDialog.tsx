"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Approve-PO confirm dialog (brief §Scope 7; spec §8; FR-PUR-002; Purchase Orders.dc.html
 * "APPROVE CONFIRM DIALOG"). A green check circle beside the title, the design's confirm copy,
 * then a ghost "Not yet" + primary "Approve". "Not yet" is default-focused. Approve is
 * server-confirmed — the parent shows a spinner on the confirm button while in flight; there
 * is no optimistic status flip.
 */
export function ApproveDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-[452px] p-[22px]"
        data-testid="po-approve-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="po-approve-cancel"]');
          btn?.focus();
        }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full bg-success-soft text-success-ink">
            <Check className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
          </span>
          <DialogTitle className="text-[17px]">Approve this purchase order?</DialogTitle>
        </div>
        <DialogDescription className="mt-3 text-[13px] leading-[1.55]">
          Once approved, bills and GRNs can be raised against it. You can still cancel it before
          any bill is raised.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="po-approve-cancel"
          >
            Not yet
          </Button>
          <Button
            size="md"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="po-approve-confirm"
          >
            {busy ? "Approving…" : "Approve"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
