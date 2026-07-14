"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

/**
 * Post confirm dialog (spec §8). Irreversible framing; the non-destructive "Keep
 * editing" is default-focused. `busy` locks both buttons during the atomic server call.
 */
export function PostPaymentDialog({
  open,
  paymentAmount,
  allocated,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  paymentAmount: string;
  allocated: string;
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
      <DialogContent data-testid="payment-post-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Post this payment?</DialogTitle>
        <DialogDescription className="mt-2">
          Posting allocates a permanent payment number and writes the balanced ledger entry.
          This can&apos;t be undone directly — correcting a posted payment requires a reversal.
        </DialogDescription>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-2 px-4 py-3">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Amount</div>
            <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">{formatMoney(paymentAmount)}</div>
          </div>
          <div className="border-l border-border pl-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Allocated</div>
            <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">{formatMoney(allocated)}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="payment-post-cancel">
            Keep editing
          </Button>
          <Button size="md" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} className="gap-1.5" data-testid="payment-post-confirm">
            <ArrowRight className="h-4 w-4" aria-hidden />
            {busy ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
