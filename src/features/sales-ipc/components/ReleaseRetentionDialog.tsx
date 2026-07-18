"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, Landmark, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import {
  emptyReleaseForm,
  formToReleaseInput,
  validateReleaseForm,
  type ReleaseFieldErrors,
  type RetentionReleaseFormValues,
} from "../schemas/retention-release.schema";
import { type ReleaseRetentionInput } from "../api/ipc-register";
import { type RetentionBreakdownItem } from "./RetentionBreakdownRow";

/**
 * Release-retention modal (spec §5 "Release dialog", §7/§8; FR-SAL-018…-020). A single-page
 * form (design's artboard 1/2) — NOT a full voucher form: the four posting dimensions + the
 * customer party are carried from the IPC automatically; submitting posts immediately (no
 * draft) and returns a gapless number. Captures release date (required) · optional amount
 * (blank ⇒ full held amount, per FR-SAL-019) · optional narration, and posts directly. The
 * irreversible-action warning is inline (always visible), and default focus is Cancel (a11y
 * §10 — the destructive action is never the default target). The over-release error is
 * `aria-describedby`-linked to the amount field; the banner slot renders `PERIOD_CLOSED` /
 * `PROJECT_CLOSED` / `NO_PERIOD_DEFINED` / `VOUCHER_NOT_POSTED` / `FORBIDDEN` and keeps the
 * dialog open with entered values so the user can retry (spec §13).
 */
function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

export function ReleaseRetentionDialog({
  open,
  item,
  projectName,
  busy,
  bannerMessage,
  fieldErrorFromServer,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  item: RetentionBreakdownItem | null;
  projectName?: string | null;
  busy: boolean;
  bannerMessage: string | null;
  fieldErrorFromServer: string | null;
  onConfirm: (input: ReleaseRetentionInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<RetentionReleaseFormValues>(emptyReleaseForm);
  const [errors, setErrors] = useState<ReleaseFieldErrors>({});
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setForm(emptyReleaseForm);
      setErrors({});
      // default-focus Cancel per spec §10 (irreversible action is not the default target)
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [open, item?.ipcId]);

  // Server-supplied field error (e.g. OVER_RELEASE) surfaces on the amount field.
  useEffect(() => {
    if (fieldErrorFromServer) {
      setErrors((prev) => ({ ...prev, releasedAmount: fieldErrorFromServer }));
    }
  }, [fieldErrorFromServer]);

  if (!item) return null;
  const held = item.retentionHeldAmount;

  function set<K extends keyof RetentionReleaseFormValues>(k: K, v: RetentionReleaseFormValues[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  }

  function submit() {
    const result = validateReleaseForm(form, held);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    onConfirm(formToReleaseInput(result.values));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent
        data-testid="release-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}
        aria-labelledby="release-dialog-title"
        aria-describedby="release-dialog-desc"
        className="max-w-[520px]"
      >
        {/* Header — lime mark + title + IPC / project subtext */}
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-token bg-accent-soft text-accent-ink" aria-hidden>
            <Landmark className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <DialogTitle id="release-dialog-title">Release retention</DialogTitle>
            <p id="release-dialog-desc" className="mt-0.5 text-[12.5px] text-muted-foreground">
              IPC #{item.ipcSeqNo}
              {projectName ? ` · ${projectName}` : ""}
            </p>
          </div>
        </div>

        {/* Not-a-voucher-form info callout */}
        <div className="mt-4 flex gap-2.5 rounded-card bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Not a full voucher form — the four posting dimensions and the customer party are carried from IPC #
            {item.ipcSeqNo} automatically. Submitting <strong className="text-foreground">posts immediately</strong>{" "}
            (no draft) and returns a gapless number.
          </span>
        </div>

        {bannerMessage && (
          <div className="mt-3" data-testid="release-banner">
            <Alert tone="destructive" title={bannerMessage} />
          </div>
        )}

        {/* Read-only IPC context */}
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            IPC <span className="font-normal normal-case text-faint">· context, read-only</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between rounded-token border border-border bg-surface-2 px-3 py-2.5">
            <span className="text-[13px] font-semibold text-foreground">
              IPC #{item.ipcSeqNo} <span className="ml-1 font-mono text-[12px] text-accent-ink">{item.entryNo}</span>
            </span>
            <span className="text-[12px] text-muted-foreground">
              held <span className="font-mono font-semibold text-foreground">৳ {money(held)}</span>
            </span>
          </div>
        </div>

        {/* Release date + amount */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="release-date">Release date *</Label>
            <DatePickerInput
              id="release-date"
              value={form.releaseDate}
              onChange={(v) => set("releaseDate", v)}
              invalid={!!errors.releaseDate}
              aria-describedby={errors.releaseDate ? "release-date-err" : undefined}
            />
            {errors.releaseDate && (
              <p id="release-date-err" className="text-[12px] font-medium text-destructive" data-testid="release-date-err">
                {errors.releaseDate}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="release-amount">
              Released amount <span className="font-normal normal-case text-faint">· optional</span>
            </Label>
            <MoneyInput
              id="release-amount"
              value={form.releasedAmount}
              onChange={(e) => set("releasedAmount", e.target.value)}
              invalid={!!errors.releasedAmount}
              aria-describedby={errors.releasedAmount ? "release-amount-err" : "release-amount-help"}
              placeholder="Full held amount"
              data-testid="release-amount"
            />
            {errors.releasedAmount ? (
              <p id="release-amount-err" className="text-[12px] font-medium text-destructive" data-testid="release-amount-err">
                {errors.releasedAmount}
              </p>
            ) : (
              <p id="release-amount-help" className="inline-flex items-center gap-1 text-[11.5px] text-success-ink">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Blank releases the full held amount ৳ {money(held)}.
              </p>
            )}
          </div>
        </div>

        {/* Narration */}
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="release-narration">
            Narration <span className="font-normal normal-case text-faint">· optional</span>
          </Label>
          <Textarea
            id="release-narration"
            value={form.narration}
            onChange={(e) => set("narration", e.target.value)}
            placeholder="সুপারস্ট্রাকচার সম্পন্ন — রিটেনশন মুক্ত করা হলো।"
            data-testid="release-narration"
          />
        </div>

        {/* Irreversible-action warning (always visible) */}
        <div className="mt-4 flex gap-2.5 rounded-card bg-warning-soft px-3 py-2.5 text-[12px] leading-relaxed text-warning-ink">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>
            This moves the amount from retention receivable to currently-due, collectible on a future receipt. This
            posts immediately and can&apos;t be undone.
          </span>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-2.5">
          <Button ref={cancelRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="release-cancel">
            Cancel
          </Button>
          <Button
            size="md"
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="release-confirm"
          >
            {busy ? "Releasing…" : "Release retention"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
