"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatMoney } from "@/lib/money";

/**
 * Post confirm dialog (spec §8; FR-HR-015). Server-confirmed only — the caller shows a
 * whole-sheet "Posting…" banner while the request is in flight. This dialog is opened
 * ONLY after the balanced-preview panel's "Preview confirmed" checkbox is ticked.
 */
export function PostConfirmDialog({
  open,
  onOpenChange,
  totalGross,
  onConfirm,
  isPosting,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalGross: string;
  onConfirm: () => void;
  isPosting: boolean;
  errorMessage?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!isPosting ? onOpenChange(v) : undefined)}>
      <DialogContent data-testid="post-confirm-dialog" className="max-w-[520px]">
        <DialogTitle>Post this salary run?</DialogTitle>
        <DialogDescription>
          This posts a ৳{formatMoney(totalGross, { withSymbol: false })} salary entry (Dr Gross Salary [+ Employer PF] /
          Cr Salary Payable + TDS + PF + Advance) tagged to cost centre <span className="font-semibold">Labour</span>.
          Once posted, this run is locked — corrections require a reversal, and payslips become available.
        </DialogDescription>

        {errorMessage && (
          <Alert tone="destructive" className="mt-4" title={errorMessage} data-testid="post-server-err" />
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPosting} data-testid="post-cancel">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPosting} data-testid="post-confirm" aria-busy={isPosting || undefined}>
            {isPosting ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
