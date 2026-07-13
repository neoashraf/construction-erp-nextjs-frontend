"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
 * Release-retention confirm dialog (spec §5 "Release dialog", §7/§8; FR-SAL-018…-020). Two
 * steps in one modal: capture (release date · optional amount · optional narration) → confirm
 * (mandatory, "This posts immediately and can't be undone." — spec §8). Amount blank ⇒ release
 * the full held amount (helper shows the current full-release amount; re-validated on submit
 * per spec §9 stale-close protection). Focus-trapped by Dialog; default focus is Cancel (a11y
 * §10 — irreversible action is not the default target). Over-release error is
 * `aria-describedby`-linked to the amount field. Banner slot renders `PERIOD_CLOSED` /
 * `PROJECT_CLOSED` / `NO_PERIOD_DEFINED` / `VOUCHER_NOT_POSTED` / `FORBIDDEN`; the dialog stays
 * open with entered values so the user can retry (spec §13).
 */
function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

export function ReleaseRetentionDialog({
  open,
  item,
  busy,
  bannerMessage,
  fieldErrorFromServer,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  item: RetentionBreakdownItem | null;
  busy: boolean;
  bannerMessage: string | null;
  fieldErrorFromServer: string | null;
  onConfirm: (input: ReleaseRetentionInput) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"capture" | "confirm">("capture");
  const [form, setForm] = useState<RetentionReleaseFormValues>(emptyReleaseForm);
  const [errors, setErrors] = useState<ReleaseFieldErrors>({});
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setStep("capture");
      setForm(emptyReleaseForm);
      setErrors({});
      // default-focus Cancel per spec §10 (irreversible action not default focus)
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [open, item?.ipcId]);

  // Server-supplied field error (e.g. OVER_RELEASE) surfaces on the amount field — drop
  // back to the capture step so the field + inline error are visible again (spec §13).
  useEffect(() => {
    if (fieldErrorFromServer) {
      setErrors((prev) => ({ ...prev, releasedAmount: fieldErrorFromServer }));
      setStep("capture");
    }
  }, [fieldErrorFromServer]);

  if (!item) return null;
  const held = item.retentionHeldAmount;

  function set<K extends keyof RetentionReleaseFormValues>(k: K, v: RetentionReleaseFormValues[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  }

  function submitCapture() {
    const result = validateReleaseForm(form, held);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    setStep("confirm");
  }

  function confirmPost() {
    const result = validateReleaseForm(form, held);
    if (result.errors) {
      setErrors(result.errors);
      setStep("capture");
      return;
    }
    onConfirm(formToReleaseInput(result.values));
  }

  const releasingAmount =
    form.releasedAmount.trim() === "" ? held : form.releasedAmount.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent
        data-testid="release-dialog"
        hideClose
        onOpenAutoFocus={(e) => e.preventDefault()}
        aria-labelledby="release-dialog-title"
        className="max-w-[520px]"
      >
        {step === "capture" ? (
          <>
            <DialogTitle id="release-dialog-title">Release retention</DialogTitle>
            <DialogDescription className="mt-1">
              For IPC <span className="font-semibold text-foreground">#{item.ipcSeqNo}</span>
              <span className="ml-1.5 font-mono text-accent-ink">{item.entryNo}</span>
              <span className="ml-2">· held ৳{money(held)}</span>
            </DialogDescription>

            {bannerMessage && (
              <div className="mt-3" data-testid="release-banner">
                <Alert tone="destructive" title={bannerMessage} />
              </div>
            )}

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
                  Released amount <span className="font-normal text-faint">· optional</span>
                </Label>
                <MoneyInput
                  id="release-amount"
                  value={form.releasedAmount}
                  onChange={(e) => set("releasedAmount", e.target.value)}
                  invalid={!!errors.releasedAmount}
                  aria-describedby={errors.releasedAmount ? "release-amount-err" : "release-amount-help"}
                  placeholder={money(held)}
                  data-testid="release-amount"
                />
                {errors.releasedAmount ? (
                  <p id="release-amount-err" className="text-[12px] font-medium text-destructive" data-testid="release-amount-err">
                    {errors.releasedAmount}
                  </p>
                ) : (
                  <p id="release-amount-help" className="text-[11.5px] text-faint">
                    Leave blank to release the full held ৳{money(held)}.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="release-narration">
                Narration <span className="font-normal text-faint">· optional</span>
              </Label>
              <Textarea
                id="release-narration"
                value={form.narration}
                onChange={(e) => set("narration", e.target.value)}
                placeholder="e.g. Defect-liability period elapsed."
                data-testid="release-narration"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <Button ref={cancelRef} variant="outline" size="md" onClick={onCancel} disabled={busy} data-testid="release-cancel">
                Cancel
              </Button>
              <Button size="md" onClick={submitCapture} disabled={busy} data-testid="release-continue">
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle id="release-dialog-title" data-testid="release-confirm-title">
              Release ৳{money(releasingAmount)} retention for IPC #{item.ipcSeqNo}?
            </DialogTitle>
            <DialogDescription className="mt-2">
              This moves the amount from retention receivable to currently-due, collectible on a future receipt. This
              posts immediately and can&apos;t be undone.
            </DialogDescription>

            {bannerMessage && (
              <div className="mt-3" data-testid="release-banner">
                <Alert tone="destructive" title={bannerMessage} />
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <Button ref={cancelRef} variant="outline" size="md" onClick={() => setStep("capture")} disabled={busy} data-testid="release-back">
                Cancel
              </Button>
              <Button size="md" onClick={confirmPost} disabled={busy} aria-busy={busy || undefined} data-testid="release-confirm">
                {busy ? "Releasing…" : "Release retention"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
