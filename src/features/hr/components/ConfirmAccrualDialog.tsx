"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { formatMoney, toDecimal } from "@/lib/money";
import { type AttendanceRecord } from "../api/attendance";
import { listPurposeOptions, type PurposeOption } from "../api/masters";
import { confirmAccrualSchema } from "../schemas/attendance.schema";

/**
 * Balanced-preview Confirm dialog (FR-HR-009..-010; spec §7/§10). Shows the accrual that
 * will post in an `aria-live="polite"` region: `headCount × dailyRate = accruedAmount`,
 * Dr labour cost / Cr labour-payable, project · cost centre · purpose tags. When the row
 * has no `purposeId` a Purpose picker becomes required — that satisfies the tag matrix
 * (`MISSING_REQUIRED_DIMENSION` guard). Confirm is deliberately non-optimistic — the
 * button shows "Posting…" until the server responds.
 */
export function ConfirmAccrualDialog({
  open,
  onOpenChange,
  row,
  projectLabel,
  costCentreLabel,
  purposeOptions,
  errorMessage,
  onConfirm,
  isPosting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: AttendanceRecord | null;
  projectLabel: string;
  costCentreLabel: string;
  purposeOptions: PurposeOption[];
  errorMessage?: string | null;
  onConfirm: (purposeId: string) => void;
  isPosting: boolean;
}) {
  const [purposeId, setPurposeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch purposes for THIS row's project when the dialog opens — the shell's project-scoped
  // fetch only runs when the filter has a project selected, but a Confirm always targets a
  // specific row with its own projectId, so the dialog owns this query.
  const rowPurposesQ = useQuery({
    queryKey: ["hr", "purposes", "confirm", row?.projectId ?? ""],
    queryFn: () => listPurposeOptions(row?.projectId ?? ""),
    enabled: open && !!row?.projectId,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const mergedPurposes = useMemo<PurposeOption[]>(() => {
    const map = new Map<string, PurposeOption>();
    for (const p of purposeOptions) map.set(p.id, p);
    for (const p of rowPurposesQ.data ?? []) map.set(p.id, p);
    return Array.from(map.values());
  }, [purposeOptions, rowPurposesQ.data]);

  useEffect(() => {
    if (open) {
      setPurposeId(row?.purposeId ?? "");
      setError(null);
    }
  }, [open, row]);

  const accrual = useMemo(() => {
    if (!row) return "0.0000";
    try {
      const rate = toDecimal(row.dailyRate ?? "0");
      return rate.times(row.headCount ?? 0).toFixed(4);
    } catch {
      return "0.0000";
    }
  }, [row]);

  const needsPurpose = !row?.purposeId;
  const selectedPurpose = mergedPurposes.find((p) => p.id === (row?.purposeId || purposeId));
  const purposeName = selectedPurpose?.name ?? "";

  function submit() {
    const value = row?.purposeId || purposeId;
    const parsed = confirmAccrualSchema.safeParse({ purposeId: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "A purpose is required to post the accrual.");
      return;
    }
    setError(null);
    onConfirm(value);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!isPosting ? onOpenChange(v) : undefined)}>
      <DialogContent data-testid="confirm-accrual-dialog" className="max-w-[520px]">
        <DialogTitle>Confirm accrual</DialogTitle>
        <DialogDescription>
          Posting this row will recognise the labour cost on accrual. It can only be corrected via Reverse.
        </DialogDescription>

        <div
          className="mt-4 rounded-card border border-border bg-surface-2 p-3"
          role="region"
          aria-live="polite"
          data-testid="balanced-preview"
        >
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Balanced preview
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2 font-mono tabular-nums text-[13px]">
            <span data-testid="preview-headcount">{row?.headCount ?? 0}</span>
            <span className="text-muted-foreground">×</span>
            <span data-testid="preview-rate">
              {formatMoney(row?.dailyRate ?? "0", { withSymbol: false })}
            </span>
            <span className="text-muted-foreground">=</span>
            <span className="text-[15px] font-bold text-foreground" data-testid="preview-accrued">
              ৳ {formatMoney(accrual, { withSymbol: false })}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <dt className="text-faint">Dr</dt>
              <dd className="font-medium text-foreground">Labour cost — {costCentreLabel}</dd>
            </div>
            <div>
              <dt className="text-faint">Cr</dt>
              <dd className="font-medium text-foreground">Labour payable</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
            <span className="inline-flex items-center gap-1 rounded-pill bg-muted px-2 py-0.5">
              <span className="text-faint">Project</span>
              <span className="font-medium text-foreground">{projectLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-pill bg-muted px-2 py-0.5">
              <span className="text-faint">Cost centre</span>
              <span className="font-medium text-foreground">{costCentreLabel}</span>
            </span>
            {purposeName && (
              <span
                className="inline-flex items-center gap-1 rounded-pill bg-muted px-2 py-0.5"
                data-testid="preview-purpose-tag"
              >
                <span className="text-faint">Purpose</span>
                <span className="font-medium text-foreground">{purposeName}</span>
              </span>
            )}
          </div>
        </div>

        {needsPurpose && (
          <div className="mt-4">
            <Label htmlFor="confirm-purpose" className="mb-1 block text-[12px] font-semibold text-foreground">
              Purpose <span className="text-destructive">*</span>
            </Label>
            <Select
              id="confirm-purpose"
              data-testid="confirm-purpose-select"
              value={purposeId}
              onChange={(e) => {
                setPurposeId(e.target.value);
                if (error) setError(null);
              }}
              invalid={!!error}
            >
              <option value="">Choose a purpose…</option>
              {mergedPurposes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {error && (
              <p className="mt-1 text-[12px] text-destructive" data-testid="confirm-purpose-err">
                {error}
              </p>
            )}
          </div>
        )}

        {errorMessage && (
          <Alert tone="destructive" className="mt-4" title={errorMessage} data-testid="confirm-server-err" />
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPosting}
            data-testid="confirm-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPosting}
            data-testid="confirm-post"
            aria-busy={isPosting || undefined}
          >
            {isPosting ? "Posting…" : "Confirm & post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
