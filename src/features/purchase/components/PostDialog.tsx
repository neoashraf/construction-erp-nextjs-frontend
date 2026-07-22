"use client";

import { ArrowRight } from "lucide-react";
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
        hideClose
        className="max-w-[452px] p-[22px]"
        data-testid="bill-post-dialog"
        role="alertdialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="bill-post-cancel"]');
          btn?.focus();
        }}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-info-soft text-info-ink">
            <ArrowRight className="h-5 w-5" aria-hidden />
          </div>
          <DialogTitle className="text-[17px]">Post this bill?</DialogTitle>
        </div>
        <DialogDescription className="mt-3 text-[13px] leading-[1.55]">
          Posting allocates the official <span className="font-semibold text-foreground">PUR/2526/…</span>{" "}
          number, moves the supplier ledger, and updates inventory. Posted bills can&apos;t be
          edited — corrections are a reverse-and-repost.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
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
