"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import { closeReasonSchema } from "../schemas/requisition-issue.schema";

/**
 * Manual-close confirm dialog (spec §8; FR-REQ-020). Higher-consequence than Issue — the
 * remaining balance is abandoned — so it's gated behind a confirm dialog with a mandatory
 * reason (Confirm disabled until non-empty, §10). Server-confirmed; the parent owns the
 * mutation + error mapping and passes any server `error` back for inline display.
 */
export function ManualCloseDialog({
  open,
  onOpenChange,
  totalOutstanding,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalOutstanding: string;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    const parsed = closeReasonSchema.safeParse({ reason });
    if (!parsed.success) {
      setLocalError(
        parsed.error.issues[0]?.message ?? "Enter a reason for closing this requisition.",
      );
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
      <DialogContent data-testid="req-close-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-token bg-warning-soft">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle>Close this requisition?</DialogTitle>
            <DialogDescription className="mt-1">
              The remaining balance ({formatMoney(totalOutstanding)}) will be abandoned — it
              won&apos;t be issued or posted, and this can&apos;t be undone.
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label
            htmlFor="req-close-reason"
            className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          >
            Reason for closing <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="req-close-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for closing…"
            invalid={!!shownError}
            aria-required="true"
            rows={3}
            data-testid="req-close-reason"
          />
          {shownError && (
            <p
              role="alert"
              className="text-[12.5px] font-medium text-destructive-ink"
              data-testid="req-close-error"
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
            data-testid="req-close-cancel"
          >
            Keep open
          </Button>
          <Button
            size="md"
            onClick={submit}
            disabled={busy || reason.trim() === ""}
            aria-busy={busy || undefined}
            data-testid="req-close-confirm"
          >
            {busy ? "Closing…" : "Close requisition"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
