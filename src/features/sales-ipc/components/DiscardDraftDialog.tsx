"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Discard-draft confirm dialog (spec §8; built from the design-system dialog defaults). A DRAFT
 * has no ledger impact and no number, so discarding just hard-deletes it (FR-SAL-023). The
 * non-destructive "Keep draft" is default-focused (a11y §10).
 */
export function DiscardDraftDialog({
  open,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) keepRef.current?.focus();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="ipc-discard-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Discard this draft?</DialogTitle>
        <DialogDescription className="mt-2">
          This draft has no ledger impact and no number yet. Discarding it can&apos;t be undone.
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="ipc-discard-keep">
            Keep draft
          </Button>
          <Button variant="destructive" size="md" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} data-testid="ipc-discard-confirm">
            {busy ? "Discarding…" : "Discard draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
