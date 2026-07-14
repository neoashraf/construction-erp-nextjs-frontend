"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

/**
 * Post confirm dialog (spec §8; design "Post confirm dialog"). Irreversible framing — the
 * non-destructive "Review again" is default-focused (spec §10). Shows the amount that will
 * settle and that the gapless RECEIPT number is allocated on post (FR-REC-013 — the FE
 * never pre-allocates). `busy` locks both buttons during the atomic server call.
 */
export function PostReceiptDialog({
  open,
  amountSettled,
  cashReceived,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  amountSettled: string;
  cashReceived: string;
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
      <DialogContent
        data-testid="receipt-post-dialog"
        hideClose
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-token bg-info-soft text-info" aria-hidden>
            <ArrowRight className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle>Post this receipt?</DialogTitle>
            <DialogDescription className="mt-2">
              Posting allocates a permanent receipt number and writes it to the ledger. This can&apos;t be
              undone directly — correcting a posted receipt requires a reversal.
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-2 px-4 py-3">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Amount settled</div>
            <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">{formatMoney(amountSettled)}</div>
          </div>
          <div className="border-l border-border pl-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Cash received</div>
            <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">{formatMoney(cashReceived)}</div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="receipt-post-cancel">
            Review again
          </Button>
          <Button size="md" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} className="gap-1.5" data-testid="receipt-post-confirm">
            <ArrowRight className="h-4 w-4" aria-hidden />
            {busy ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
