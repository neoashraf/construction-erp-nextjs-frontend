"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Post-Bill confirm dialog (brief §Scope 8; spec §8; FR-PUR-008…-013). Modal with
 * "Not yet" default-focused (non-destructive). Post is atomic — LED + INV + NUM in one
 * transaction — and long-running by the platform's <2s NFR budget; the FE treats it as
 * a non-cancellable in-flight state (button shows "Posting…", editor is locked).
 */
export function PostDialog({
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
        data-testid="bill-post-dialog"
        role="alertdialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="bill-post-cancel"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Post this bill?</DialogTitle>
        <DialogDescription className="mt-2">
          Posting allocates the official entry number, moves the supplier ledger, and
          updates inventory. Posted bills can&apos;t be edited — corrections are a
          reverse-and-repost.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="bill-post-cancel"
          >
            Not yet
          </Button>
          <Button
            size="md"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="bill-post-confirm"
          >
            {busy ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
