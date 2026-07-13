"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

/**
 * Repost / correction confirm dialog (spec §8; built from the design-system dialog defaults).
 * Reverse-and-repost: LED reverses the original and posts the corrected figures in one
 * transaction; each entry takes its own number, the original number is retained (FR-SAL-022).
 * A reason is mandatory; the non-destructive "Keep editing" is default-focused (a11y §10).
 */
export function RepostDialog({
  open,
  currentlyDue,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  currentlyDue: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      keepRef.current?.focus();
    }
  }, [open]);

  function confirm() {
    if (!reason.trim()) {
      setError("Enter a reason for correcting this IPC.");
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="ipc-repost-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Post this correction?</DialogTitle>
        <DialogDescription className="mt-2">
          This reverses the original entry and posts the corrected figures as a new numbered entry. The original IPC
          number is retained. This can&apos;t be undone.
        </DialogDescription>

        <div className="mt-4 rounded-card border border-border bg-surface-2 px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Corrected currently due</div>
          <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">{formatMoney(currentlyDue)}</div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="ipc-repost-reason">Reason</Label>
          <Textarea
            id="ipc-repost-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            invalid={!!error}
            aria-describedby={error ? "ipc-repost-reason-err" : undefined}
            placeholder="What is being corrected?"
            data-testid="ipc-repost-reason"
          />
          {error && (
            <p id="ipc-repost-reason-err" className="text-[12px] font-medium text-destructive" data-testid="ipc-repost-reason-err">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="ipc-repost-keep">
            Keep editing
          </Button>
          <Button size="md" onClick={confirm} disabled={busy} aria-busy={busy || undefined} data-testid="ipc-repost-confirm">
            {busy ? "Posting correction…" : "Post correction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
