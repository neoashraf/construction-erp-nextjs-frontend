"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Reject-reason capture (spec §7/§8/§9). Reject is higher-friction than Approve — a mandatory
 * non-empty reason is required before it fires. Two presentations off one shared form:
 *  - `RejectReasonPanel` — the inline panel that replaces the action bar on desktop/tablet.
 *  - `RejectReasonSheet` — a full-screen bottom sheet on mobile (maximised typing room, §4).
 * Empty-submit surfaces the inline `role="alert"` required message (§10); the field uses the
 * shared error state (`destructive` border + ring). Confirmation is server-driven.
 */

interface RejectFormProps {
  reason: string;
  onReasonChange: (v: string) => void;
  error: string | null;
  requisitionNo: string;
  requesterName?: string;
  fieldId: string;
  autoFocus?: boolean;
}

function RejectReasonFields({
  reason,
  onReasonChange,
  error,
  requisitionNo,
  requesterName,
  fieldId,
  autoFocus,
}: RejectFormProps) {
  const errorId = `${fieldId}-error`;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-muted-foreground">
        Rejecting <span className="font-semibold text-foreground">{requisitionNo}</span>
        {requesterName ? (
          <span className="[overflow-wrap:anywhere]"> · {requesterName}</span>
        ) : null}
      </p>
      <label
        htmlFor={fieldId}
        className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        Reason for rejection <span className="text-destructive">*</span>
      </label>
      <Textarea
        id={fieldId}
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="Reason for rejection…"
        invalid={!!error}
        aria-required="true"
        aria-describedby={error ? errorId : undefined}
        autoFocus={autoFocus}
        rows={4}
        data-testid="req-reject-reason"
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-[12.5px] font-medium text-destructive-ink"
          data-testid="req-reject-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface RejectActionProps {
  reason: string;
  onReasonChange: (v: string) => void;
  error: string | null;
  requisitionNo: string;
  requesterName?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Inline reject panel (desktop / tablet) — replaces the approval note + action bar. */
export function RejectReasonPanel(props: RejectActionProps) {
  const fieldId = useId();
  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-surface"
      data-testid="req-reject-panel"
    >
      <div className="border-b border-destructive-soft bg-destructive-soft px-5 py-3.5">
        <p className="text-sm font-semibold text-destructive-ink">Reject this requisition?</p>
        <p className="mt-0.5 text-[12.5px] text-destructive-ink/80">
          Let the requester know why. This reason is required and will be visible to them.
        </p>
      </div>
      <div className="px-5 py-4">
        <RejectReasonFields
          reason={props.reason}
          onReasonChange={props.onReasonChange}
          error={props.error}
          requisitionNo={props.requisitionNo}
          requesterName={props.requesterName}
          fieldId={fieldId}
          autoFocus
        />
      </div>
      <div className="flex items-center justify-end gap-2.5 border-t border-border px-5 py-3.5">
        <Button
          variant="ghost"
          size="md"
          onClick={props.onCancel}
          disabled={props.busy}
          data-testid="req-reject-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="md"
          onClick={props.onConfirm}
          disabled={props.busy}
          aria-busy={props.busy || undefined}
          data-testid="req-reject-confirm"
        >
          {props.busy ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

/** Full-screen bottom sheet (mobile) — the same fields with more typing room (§4). */
export function RejectReasonSheet({
  open,
  onOpenChange,
  ...props
}: RejectActionProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const fieldId = useId();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        // Anchor to the bottom, full-width, on the small viewport this is used for (lg:hidden
        // so it never overlays the desktop inline panel, which shares the same `open` state).
        className={cn(
          "inset-x-0 bottom-0 left-0 right-0 top-auto h-auto max-h-[92%] w-full max-w-full rounded-t-card lg:hidden",
          "data-[state=open]:animate-[toastIn_0.24s_ease]",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="req-reject-sheet"
      >
        <div className="border-b border-border px-5 py-4">
          <p className="text-base font-bold text-destructive-ink">Reject this requisition?</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Let the requester know why. This reason is required and will be visible to them.
          </p>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          <RejectReasonFields
            reason={props.reason}
            onReasonChange={props.onReasonChange}
            error={props.error}
            requisitionNo={props.requisitionNo}
            requesterName={props.requesterName}
            fieldId={fieldId}
            autoFocus
          />
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-border px-5 py-4">
          <Button
            variant="outline"
            size="md"
            onClick={props.onCancel}
            disabled={props.busy}
            data-testid="req-reject-cancel-mobile"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={props.onConfirm}
            disabled={props.busy}
            aria-busy={props.busy || undefined}
            data-testid="req-reject-confirm-mobile"
          >
            {props.busy ? "Rejecting…" : "Reject requisition"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
