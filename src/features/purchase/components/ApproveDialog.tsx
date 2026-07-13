"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Approve-PO confirm dialog (brief §Scope 7; spec §8; FR-PUR-002). Modal with the
 * "Not yet" (non-destructive) button default-focused (`onOpenAutoFocus` prevented so we
 * can focus it explicitly). Approve is server-confirmed — the parent shows a spinner on
 * the confirm button while the request is in flight; there is no optimistic status flip.
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
        data-testid="po-approve-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="po-approve-cancel"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Approve this purchase order?</DialogTitle>
        <DialogDescription className="mt-2">
          Once approved, the header and lines are locked and a bill or GRN can be raised against
          it. Approval writes no ledger line and draws no PO number — that happens at bill posting.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
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
