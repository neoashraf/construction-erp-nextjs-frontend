"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import { type Receipt } from "../types";

/**
 * Repost / Correct dialog (spec §7/§8; design "Correct dialog"). Opens an editable
 * subset of the FE-43 editor field set pre-filled from the current receipt inside a
 * correction dialog and posts a **new** entry via `POST /api/receipt/{id}/repost`
 * (FR-REC-021/-023) — never a resurrection of the old draft. Reason is mandatory.
 *
 * Field set is scoped to what a correction can *change* client-side: amount settled +
 * tax deducted at source (IPC-linked) or amount settled alone (general). Everything
 * else (mode, deposit account, party, IPC/general target, dimensions) is echoed as
 * read-only summary so the correction is unambiguous. A bigger structural change is
 * a cancel + fresh draft.
 */
export function RepostReceiptDialog({
  open,
  busy,
  receipt,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  receipt: Receipt;
  onConfirm: (input: { amountSettled: string; taxDeductedAtSource: string; reason: string }) => void;
  onCancel: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const [amount, setAmount] = useState(receipt.amountSettled);
  const [tds, setTds] = useState(receipt.taxDeductedAtSource);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(receipt.amountSettled);
      setTds(receipt.taxDeductedAtSource);
      setReason("");
      setReasonErr(null);
      keepRef.current?.focus();
    }
  }, [open, receipt.amountSettled, receipt.taxDeductedAtSource]);

  const isIpc = receipt.receiptType === "IPC_LINKED";

  function confirm() {
    if (!reason.trim()) {
      setReasonErr("Enter a reason for correcting this receipt.");
      return;
    }
    onConfirm({
      amountSettled: amount || "0",
      taxDeductedAtSource: isIpc ? (tds || "0") : "0",
      reason: reason.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent data-testid="receipt-repost-dialog" hideClose onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-[520px]">
        <DialogTitle>Correct this receipt</DialogTitle>
        <DialogDescription className="mt-2">
          Posts a new corrected entry and reverses the original. The original receipt number is
          retained; each new entry takes its own number. This can&apos;t be undone.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <Label htmlFor="receipt-repost-amount">Amount settled</Label>
            <MoneyInput
              id="receipt-repost-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
              data-testid="receipt-repost-amount"
            />
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Was <span className="font-mono tabular-nums">{formatMoney(receipt.amountSettled)}</span>
            </p>
          </div>
          {isIpc && (
            <div>
              <Label htmlFor="receipt-repost-tds">Tax deducted at source</Label>
              <MoneyInput
                id="receipt-repost-tds"
                value={tds}
                onChange={(e) => setTds(e.target.value)}
                disabled={busy}
                data-testid="receipt-repost-tds"
              />
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Was <span className="font-mono tabular-nums">{formatMoney(receipt.taxDeductedAtSource)}</span>
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="receipt-repost-reason">Reason</Label>
            <Textarea
              id="receipt-repost-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonErr) setReasonErr(null);
              }}
              invalid={!!reasonErr}
              placeholder="Why is this receipt being corrected?"
              data-testid="receipt-repost-reason"
            />
            {reasonErr && (
              <p role="alert" className="mt-1 text-[12px] font-medium text-destructive" data-testid="receipt-repost-reason-err">
                {reasonErr}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={keepRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="receipt-repost-keep">
            Keep it
          </Button>
          <Button size="md" onClick={confirm} disabled={busy} aria-busy={busy || undefined} data-testid="receipt-repost-confirm">
            {busy ? "Correcting…" : "Post correction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
