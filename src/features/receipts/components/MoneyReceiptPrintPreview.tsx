"use client";

import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { amountInWords, formatMoney } from "@/lib/money";
import { paymentModeLabel } from "./PaymentModeTag";
import { type Receipt } from "../types";

/**
 * Money-receipt print preview (spec §B; FR-REC-025; brief §5.11 + G3). Renders the
 * acknowledgement built from the already-loaded receipt + master lookups (no re-entry).
 * The actual PDF is RPT-produced — this is the on-screen preview until RPT's
 * FileExporter lands; the "Print" button uses the browser's window.print(). Missing
 * company identifiers show "Not on file" on-screen only — never fabricated on the
 * document.
 */
export function MoneyReceiptPrintPreview({
  open,
  receipt,
  companyName,
  companyAddress,
  companyTin,
  companyBin,
  partyName,
  depositAccountName,
  ipcLabel,
  onClose,
}: {
  open: boolean;
  receipt: Receipt;
  companyName: string | null;
  companyAddress: string | null;
  companyTin: string | null;
  companyBin: string | null;
  partyName: string | null;
  depositAccountName: string | null;
  ipcLabel: string | null;
  onClose: () => void;
}) {
  const isCancelled = receipt.status === "CANCELLED";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[720px] p-0"
        data-testid="receipt-print-preview"
        hideClose
      >
        <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-5 py-3">
          <DialogTitle className="text-[13px] font-bold text-foreground">
            Money receipt · {receipt.entryNo ?? "—"}
          </DialogTitle>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="receipt-print-do">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" data-testid="receipt-print-close">
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="max-h-[80vh] overflow-auto bg-muted px-6 py-5">
          <article
            className="mx-auto max-w-[640px] rounded-token bg-surface p-8 shadow-sm print:shadow-none"
            data-testid="receipt-print-document"
          >
            {isCancelled && (
              <div className="mb-4 rounded-token border border-warning-soft bg-warning-soft px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.3px] text-warning-ink" data-testid="receipt-print-cancelled">
                Cancelled — retained for audit
              </div>
            )}

            <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="text-[15px] font-bold text-foreground">{companyName ?? "Not on file"}</div>
                <div className="text-[11.5px] text-muted-foreground [overflow-wrap:anywhere]">
                  {companyAddress ?? "Not on file"}
                </div>
                <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                  <span>TIN: <span className="font-mono">{companyTin ?? "Not on file"}</span></span>
                  <span>BIN: <span className="font-mono">{companyBin ?? "Not on file"}</span></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                  Money Receipt
                </div>
                <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-foreground">
                  {receipt.entryNo ?? "—"}
                </div>
                <div className="mt-1 text-[11.5px] text-muted-foreground">
                  {formatDate(receipt.receiptDate)}
                </div>
              </div>
            </header>

            <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px]">
              <Field label="Received from" value={partyName ?? "Not on file"} bn />
              <Field
                label="Payment mode"
                value={
                  receipt.paymentMode
                    ? `${paymentModeLabel(receipt.paymentMode)}${receipt.chequeTxnRef ? ` · ${receipt.chequeTxnRef}` : ""}`
                    : "—"
                }
              />
              <Field label="Deposit account" value={depositAccountName ?? "Not on file"} />
              {ipcLabel && <Field label="Against IPC" value={ipcLabel} />}
            </section>

            <section className="mt-5 rounded-token border border-border bg-surface-2 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                  Amount received
                </span>
                <span className="font-mono text-[20px] font-bold tabular-nums text-foreground">
                  {formatMoney(receipt.amountSettled)}
                </span>
              </div>
              <p className="mt-1 text-[11px] italic text-muted-foreground" data-testid="receipt-print-in-words">
                {`in words — ${amountInWords(receipt.amountSettled)} taka only`}
              </p>
              {Number(receipt.taxDeductedAtSource) > 0 && (
                <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted-foreground">
                  <span>Tax deducted at source</span>
                  <span className="font-mono tabular-nums">{formatMoney(receipt.taxDeductedAtSource)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between text-[12px] font-semibold text-foreground">
                <span>Cash received</span>
                <span className="font-mono tabular-nums">{formatMoney(receipt.cashReceived)}</span>
              </div>
            </section>

            {receipt.narration && (
              <section className="mt-5 text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">Narration: </span>
                <span className="bn [overflow-wrap:anywhere]">{receipt.narration}</span>
              </section>
            )}

            <footer className="mt-10 flex items-end justify-between gap-6 pt-6 text-[11.5px] text-muted-foreground">
              <div className="w-1/2">
                <div className="border-t border-border pt-2">Received by</div>
              </div>
              <div className="w-1/2 text-right">
                <div className="border-t border-border pt-2">Authorised signature</div>
              </div>
            </footer>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, bn }: { label: string; value: string; bn?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[12.5px] text-foreground [overflow-wrap:anywhere] ${bn ? "bn" : ""}`}>{value}</div>
    </div>
  );
}
