"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cancelBillSchema } from "../schemas/bill.schema";

/**
 * Cancel-Bill confirm dialog (brief §Scope 10; spec §8; FR-PUR-022; Purchase Bill.dc.html
 * viewer). A destructive-intent alertdialog: warning-triangle icon + title on one row, the
 * reverse-and-repost consequence copy, and a mandatory non-empty reason (zod-validated on
 * submit). Default focus is on the non-destructive "Keep bill" (ghost); the confirm is the
 * red-filled "Cancel bill". A server-side `409 BILL_HAS_APPLIED_PAYMENTS` closes the dialog
 * and surfaces the exact inline banner in the viewer.
 */
export function CancelBillDialog({
  open,
  busy,
  entryNo,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  entryNo: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  function submit() {
    const parsed = cancelBillSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a reason for this cancellation.");
      return;
    }
    setError(null);
    onConfirm(parsed.data.reason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-[472px] p-[22px]"
        data-testid="bill-cancel-dialog"
        role="alertdialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="bill-cancel-keep"]');
          btn?.focus();
        }}
      >
        <div className="flex items-center gap-[11px]">
          <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full bg-destructive-soft text-destructive-ink">
            <AlertTriangle className="h-[19px] w-[19px]" aria-hidden />
          </span>
          <DialogTitle className="text-[17px]">Cancel this posted bill?</DialogTitle>
        </div>
        <DialogDescription className="mt-3 text-[13px] leading-[1.6]">
          This reverses the ledger entry and the inventory receipt. The original number{" "}
          {entryNo ? <span className="font-mono font-semibold text-foreground">{entryNo}</span> : "on this bill"} is
          kept on the reversed bill. This can&apos;t be undone.
        </DialogDescription>
        <div className="mt-3.5 flex flex-col gap-1.5">
          <Label htmlFor="bill-cancel-reason" className="text-[10.5px] uppercase tracking-[0.4px] text-muted-foreground">
            Reason
            <span className="ml-0.5 text-destructive-ink" aria-hidden>
              *
            </span>
          </Label>
          <Textarea
            id="bill-cancel-reason"
            rows={2}
            placeholder="Wrong VAT rate applied on the freight line."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            data-testid="bill-cancel-reason"
          />
          {error && (
            <p className="text-[12px] text-destructive-ink" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="mt-[18px] flex justify-end gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="bill-cancel-keep"
          >
            Keep bill
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="bill-cancel-confirm"
          >
            {busy ? "Cancelling…" : "Cancel bill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
