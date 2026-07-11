"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { negativeStockSchema } from "../schemas/stock-journal.schema";

/**
 * "Allow negative stock?" override dialog (FR-INV-014/015; spec §7/§8). Shown only to an
 * actor holding the negative-stock authorisation when quantity exceeds on-hand. Requires
 * an explicit authorise checkbox + a mandatory reason (recorded + audited on the movement).
 * Confirm posts with `allowNegativeStock=true`; the Editor owns the mutation + error map.
 */
export function NegativeStockDialog({
  open,
  itemName,
  godownName,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  itemName: string;
  godownName: string;
  pending: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [authorised, setAuthorised] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function confirm() {
    const parsed = negativeStockSchema.safeParse({ reason });
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message ?? "Enter a reason for allowing negative stock.");
      return;
    }
    setReasonError(null);
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose data-testid="sj-negative-dialog">
        <DialogTitle>Allow negative stock?</DialogTitle>
        <DialogDescription className="mt-2">
          This will let {itemName} at {godownName} go below zero. This action is recorded and audited.
        </DialogDescription>

        <label className="mt-4 flex items-start gap-2.5 text-sm text-foreground">
          <Checkbox
            checked={authorised}
            onChange={(e) => setAuthorised(e.target.checked)}
            data-testid="sj-negative-authorise"
            className="mt-0.5"
          />
          <span>I authorise this stock to go negative.</span>
        </label>

        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="sj-negative-reason">Reason</Label>
          <Textarea
            id="sj-negative-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            invalid={!!reasonError}
            placeholder="e.g. issued before the next delivery arrives"
            data-testid="sj-negative-reason"
          />
          {reasonError && <p className="text-[11.5px] text-destructive-ink" data-testid="sj-negative-reason-error">{reasonError}</p>}
        </div>

        {error && (
          <p className="mt-3 rounded-card border border-destructive-soft bg-destructive-soft px-3 py-2 text-[12px] text-destructive-ink" data-testid="sj-negative-error">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={confirm}
            disabled={pending || !authorised}
            aria-busy={pending || undefined}
            data-testid="sj-negative-confirm"
          >
            {pending ? "Posting…" : "Post anyway"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
