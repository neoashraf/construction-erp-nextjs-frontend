"use client";

import { useEffect, useRef } from "react";
import { AlertOctagon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

/**
 * One-time-action confirm dialog for the opening journal (spec §8; FR-GEN-012). The
 * non-destructive "Review again" is default-focused — the safer default for an
 * action that cannot be repeated per company.
 */
export function OpeningPostDialog({
  open,
  totalDebit,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  totalDebit: string;
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
      <DialogContent data-testid="opening-post-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-token bg-warning-soft text-warning-ink" aria-hidden>
            <AlertOctagon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle>Post the opening journal?</DialogTitle>
            <DialogDescription className="mt-2">
              This posts every reviewed line to the ledger as a single balanced entry and
              consumes the one-time-per-company opening slot. Corrections are made by
              reversing this entry and posting a corrected opening — never a second one.
            </DialogDescription>
          </div>
        </div>
        <div className="mt-4 rounded-card border border-border bg-surface-2 px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Total (Dr = Cr)</div>
          <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">
            {formatMoney(totalDebit)}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="opening-post-cancel">
            Review again
          </Button>
          <Button size="md" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} className="gap-1.5" data-testid="opening-post-confirm">
            <ArrowRight className="h-4 w-4" aria-hidden />
            {busy ? "Posting…" : "Post opening journal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
