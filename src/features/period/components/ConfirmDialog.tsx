"use client";

import { useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * The one confirm-dialog shell reused for Generate / Close / Reopen / Close-all
 * (spec §6/§8/§9/§10). Every action opens this first — no API call fires until
 * Confirm. Initial focus goes to the safe **Cancel** control (spec §10); Esc /
 * Cancel dismiss without calling the API (Radix `onOpenChange`). A dialog-level
 * error (e.g. the `PERIOD_FY_LOCKED` year-locked message) renders inline and
 * disables Confirm rather than closing the dialog out from under the user.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  confirmingLabel,
  destructive,
  busy,
  error,
  confirmDisabled,
  onConfirm,
  onCancel,
  testId,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  confirmingLabel?: string;
  /** Reopen/close-all use the primary tone; nothing on this screen is destructive-red today. */
  destructive?: boolean;
  busy: boolean;
  /** An inline error surfaced in the dialog instead of closing it (e.g. PERIOD_FY_LOCKED). */
  error?: string | null;
  /** True once `error` makes the action unrecoverable without leaving the dialog (FY-locked). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        hideClose
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">{body}</DialogDescription>

        {error && (
          <div
            role="alert"
            data-testid={`${testId}-error`}
            className="mt-3.5 flex items-start gap-2.5 rounded-token border border-destructive/40 bg-destructive-soft px-3 py-2.5"
          >
            <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground">
              !
            </span>
            <span className="text-[12.5px] font-medium leading-relaxed text-destructive-ink">
              {error}
            </span>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={busy}
            data-testid={`${testId}-cancel`}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            aria-busy={busy || undefined}
            data-testid={`${testId}-confirm`}
          >
            {busy ? confirmingLabel ?? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
