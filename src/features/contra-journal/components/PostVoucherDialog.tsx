"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

/**
 * Post confirm dialog for GEN vouchers (spec §8). Non-destructive "Keep editing"
 * default-focused. Reused by contra + journal editors.
 */
export function PostVoucherDialog({
  open,
  title = "Post this voucher?",
  totalDebit,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
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
      <DialogContent data-testid="voucher-post-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">
          Posting allocates a permanent voucher number and writes the balanced ledger entry.
          This can&apos;t be undone directly — correcting a posted voucher requires a reversal.
        </DialogDescription>
        <div className="mt-4 rounded-card border border-border bg-surface-2 px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Total (Dr = Cr)
          </div>
          <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">
            {formatMoney(totalDebit)}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="voucher-post-cancel">
            Keep editing
          </Button>
          <Button size="md" onClick={onConfirm} disabled={busy} className="gap-1.5" data-testid="voucher-post-confirm">
            <ArrowRight className="h-4 w-4" aria-hidden />
            {busy ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
