"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { repostBillSchema } from "../schemas/bill.schema";

/**
 * Repost / Correct dialog (brief §Scope 11; spec §8; FR-PUR-022, FR-PUR-023). Mandatory
 * non-empty reason. Default focus is on the non-destructive "Keep original" button.
 * The corrected bill fields come from the editor form; this dialog only collects the
 * reason and the confirmation.
 */
export function RepostDialog({
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
    const parsed = repostBillSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a reason for this correction.");
      return;
    }
    setError(null);
    onConfirm(parsed.data.reason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="bill-repost-dialog"
        role="alertdialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="bill-repost-keep"]');
          btn?.focus();
        }}
      >
        <DialogTitle>Correct this bill?</DialogTitle>
        <DialogDescription className="mt-2">
          This reverses the original entry{" "}
          {entryNo ? <strong>{entryNo}</strong> : "on this bill"} and posts your corrected
          figures as a new entry. The original number stays on the reversed bill; the
          correction gets its own number.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="bill-repost-reason">Reason</Label>
          <Textarea
            id="bill-repost-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            data-testid="bill-repost-reason"
          />
          {error && (
            <p className="text-[12px] text-destructive-ink" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="bill-repost-keep"
          >
            Keep original
          </Button>
          <Button
            size="md"
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="bill-repost-confirm"
          >
            {busy ? "Reposting…" : "Repost"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
