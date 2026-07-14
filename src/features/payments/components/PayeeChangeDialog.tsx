"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Payee-change confirm dialog (Open item 4). Fires only when allocations exist —
 * changing the payee will clear the current allocations. Non-destructive "Keep it"
 * default-focused (a11y §10).
 */
export function PayeeChangeDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) keepRef.current?.focus();
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="payment-payee-change-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-token bg-warning-soft text-warning-ink" aria-hidden>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle>Change the payee?</DialogTitle>
            <DialogDescription className="mt-2">
              Changing the payee will clear the current allocations — the new payee&apos;s open payables
              will populate the picker instead.
            </DialogDescription>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} data-testid="payment-payee-change-keep">
            Keep it
          </Button>
          <Button size="md" onClick={onConfirm} data-testid="payment-payee-change-confirm">
            Change payee
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
