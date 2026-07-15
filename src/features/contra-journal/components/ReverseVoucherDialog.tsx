"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Reverse confirm dialog for GEN vouchers (spec §8). Mandatory reason; non-destructive
 * "Keep it" default-focused. Reused by contra + journal editors.
 */
export function ReverseVoucherDialog({
  open,
  title = "Reverse this voucher?",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) {
      setReason("");
      setErr(null);
      keepRef.current?.focus();
    }
  }, [open]);
  function confirm() {
    if (!reason.trim()) {
      setErr("Enter a reason for reversing this voucher.");
      return;
    }
    onConfirm(reason.trim());
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="voucher-reverse-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">
          This writes a linked reversal entry with the debits/credits swapped. The original
          voucher number is retained; the reversal takes its own number.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="voucher-reverse-reason">Reason</Label>
          <Textarea
            id="voucher-reverse-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (err) setErr(null);
            }}
            invalid={!!err}
            placeholder="Why is this voucher being reversed?"
            data-testid="voucher-reverse-reason"
          />
          {err && (
            <p role="alert" className="text-[12px] font-medium text-destructive" data-testid="voucher-reverse-reason-err">
              {err}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="voucher-reverse-keep">
            Keep it
          </Button>
          <Button variant="destructive" size="md" onClick={confirm} disabled={busy} data-testid="voucher-reverse-confirm">
            {busy ? "Reversing…" : "Reverse"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
