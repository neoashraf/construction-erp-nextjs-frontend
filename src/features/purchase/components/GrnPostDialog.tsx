"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Post-GRN confirm dialog (brief §Scope 6; spec §8). Modal with "Not yet"
 * default-focused (non-destructive). Post is atomic — INV `receiveIn` per line —
 * and long-running; the FE treats it as a non-cancellable in-flight state
 * (button shows "Posting…", grid is locked). `role="alertdialog"` so the
 * irreversibility copy is announced first (spec §10).
 */
export function GrnPostDialog({
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
        data-testid="grn-post-dialog"
        role="alertdialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="grn-post-cancel"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Post this goods receipt?</DialogTitle>
        <DialogDescription className="mt-2">
          Posting updates the godown&apos;s stock for the quantity you actually received.
          This can&apos;t be undone from here — corrections are a new GRN or a reversal.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="grn-post-cancel"
          >
            Not yet
          </Button>
          <Button
            size="md"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="grn-post-confirm"
          >
            {busy ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
