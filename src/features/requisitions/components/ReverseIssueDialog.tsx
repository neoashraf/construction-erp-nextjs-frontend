"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { reverseReasonSchema } from "../schemas/requisition-issue.schema";

/**
 * Reverse-issue confirm dialog (spec §8; FR-REQ-017). Reversing restores the issued quantity to
 * the outstanding balance and reverses the posted consumption entry (append-only — the original
 * issue is never edited). Gated behind a confirm dialog with a mandatory reason (Confirm disabled
 * until non-empty, §10). Server-confirmed; the parent owns the mutation + error mapping.
 */
export function ReverseIssueDialog({
  open,
  onOpenChange,
  entryNo,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryNo: string | null;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    const parsed = reverseReasonSchema.safeParse({ reason });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? "Enter a reason for reversing this issue.");
      return;
    }
    setLocalError(null);
    onConfirm(parsed.data.reason);
  }

  const shownError = localError ?? error;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          setLocalError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent data-testid="req-reverse-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-token bg-destructive-soft">
            <RotateCcw className="h-4 w-4 text-destructive" aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle>Reverse this issue?</DialogTitle>
            <DialogDescription className="mt-1">
              This restores the issued quantity back to the outstanding balance and reverses the
              posted consumption entry{entryNo ? ` (${entryNo})` : ""}. This can&apos;t be undone.
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label
            htmlFor="req-reverse-reason"
            className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          >
            Reason for reversal <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="req-reverse-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for reversal…"
            invalid={!!shownError}
            aria-required="true"
            rows={3}
            data-testid="req-reverse-reason"
          />
          {shownError && (
            <p
              role="alert"
              className="text-[12.5px] font-medium text-destructive-ink"
              data-testid="req-reverse-error"
            >
              {shownError}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            data-testid="req-reverse-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={submit}
            disabled={busy || reason.trim() === ""}
            aria-busy={busy || undefined}
            data-testid="req-reverse-confirm"
          >
            {busy ? "Reversing…" : "Reverse issue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
