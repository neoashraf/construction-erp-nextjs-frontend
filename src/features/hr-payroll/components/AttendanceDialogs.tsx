"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { displayMoney } from "../lib";
import { PURPOSES, DEFAULT_PROJECT, type DailyLabourRow } from "../seed/attendance";

const isBn = (s: string) => /[ঀ-৿]/.test(s);

/** A dimension chip (project · cost centre · purpose) — accent/lime tag. */
function DimChip({ children, warning }: { children: React.ReactNode; warning?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium",
        warning ? "bg-warning-soft text-warning-ink" : "bg-accent-soft text-accent-ink",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Confirm daily-labour accrual (FR-HR-009; Attendance.dc.html). Posts a
 * Dr Labour Cost / Cr Labour Payable accrual for one row, tagged project + cost centre
 * + purpose. Purpose is required to confirm. Once confirmed the row is locked.
 */
export function ConfirmAccrualDialog({
  row,
  onClose,
  onConfirmed,
}: {
  row: DailyLabourRow | null;
  onClose: () => void;
  onConfirmed: (rowId: string, entryNo: string) => void;
}) {
  const { toast } = useToast();
  const [purpose, setPurpose] = useState<string | null>(row?.purpose ?? null);
  const [err, setErr] = useState(false);

  // Re-seed the purpose when a new row opens.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (row && seededFor !== row.id) {
    setSeededFor(row.id);
    setPurpose(row.purpose ?? null);
    setErr(false);
  }

  const amount = row ? (row.headCount * row.rate).toFixed(4) : "0";

  function confirm() {
    if (!row) return;
    if (!purpose) {
      setErr(true);
      return;
    }
    const entryNo = "JV-2026-000421";
    toast(`Accrual posted — entry ${entryNo}.`, "success");
    onConfirmed(row.id, entryNo);
    onClose();
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]" data-testid="confirm-accrual-dialog">
        {row && (
          <>
            <DialogTitle>Confirm daily-labour accrual</DialogTitle>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className={cn("text-[13px] font-semibold text-foreground", isBn(row.category) && "font-sans")}>
                {row.category} · {row.costCentre}
              </span>
              <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {row.headCount} × {displayMoney(row.rate.toFixed(4))}
              </span>
            </div>

            {/* Dr/Cr preview */}
            <div className="mt-3 overflow-hidden rounded-token border border-border">
              <div className="flex items-center gap-3 border-b border-border px-3 py-2">
                <Badge tone="success">DR</Badge>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                  Labour Cost — Site Wages
                </span>
                <span className="font-mono text-[12.5px] tabular-nums text-foreground">
                  {displayMoney(amount)}
                </span>
              </div>
              <div className="flex items-center gap-3 border-b border-border px-3 py-2">
                <Badge tone="destructive">CR</Badge>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                  Labour Payable
                </span>
                <span className="font-mono text-[12.5px] tabular-nums text-foreground">
                  {displayMoney(amount)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 bg-surface-2 px-3 py-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Tagged
                </span>
                <DimChip>{DEFAULT_PROJECT}</DimChip>
                <DimChip>{row.costCentre}</DimChip>
                {purpose ? <DimChip>{purpose}</DimChip> : <DimChip warning>Purpose not set</DimChip>}
              </div>
            </div>

            {/* Purpose */}
            <div className="mt-3.5">
              <Label className="mb-1.5 block text-[11px]">
                Purpose <span className="text-destructive">*</span> — required to confirm
              </Label>
              <div className="flex flex-wrap gap-2">
                {PURPOSES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPurpose(p);
                      setErr(false);
                    }}
                    className={cn(
                      "rounded-pill border px-3 py-1 text-[12.5px] font-medium transition-colors",
                      purpose === p
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-border-strong bg-surface text-muted-foreground hover:border-faint",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {err && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  Select a purpose to confirm this entry.
                </p>
              )}
            </div>

            <DialogDescription className="mt-3 text-[12.5px]">
              This posts a {displayMoney(amount)} labour cost entry (Dr Labour Cost / Cr Labour
              Payable) tagged to {DEFAULT_PROJECT} · {row.costCentre} · {purpose ?? "—"}. Once
              confirmed, this entry is locked — corrections require a reversal.
            </DialogDescription>

            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button size="md" onClick={confirm} data-testid="confirm-accrual-submit">
                Confirm &amp; post
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reverse a confirmed accrual (FR-HR-012). Posts a reversing entry against the
 * original; the original stays on record. A reason is required.
 */
export function ReverseAccrualDialog({
  row,
  onClose,
  onReversed,
}: {
  row: DailyLabourRow | null;
  onClose: () => void;
  onReversed: (rowId: string, reversalNo: string) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState(false);

  function reverse() {
    if (!row) return;
    if (!reason.trim()) {
      setErr(true);
      return;
    }
    const reversalNo = "JV-2026-000431";
    toast(`Entry reversed — ${reversalNo}.`, "success");
    onReversed(row.id, reversalNo);
    setReason("");
    setErr(false);
    onClose();
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px]" data-testid="reverse-accrual-dialog">
        {row && (
          <>
            <DialogTitle>Reverse this accrual?</DialogTitle>
            <DialogDescription className="mt-1.5">
              This posts a reversing entry against{" "}
              <span className="font-mono text-foreground">{row.confirmedEntryNo}</span>. The original
              stays on record; a corrected entry can be entered fresh.
            </DialogDescription>
            <div className="mt-3.5">
              <Label className="mb-1.5 block text-[11px]">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (err) setErr(false);
                }}
                invalid={err}
                placeholder="e.g. head count entered as 20, actual was 18 — সংশোধন প্রয়োজন"
              />
              {err && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  A reason is required to reverse a posted accrual.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="md"
                variant="outline"
                className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
                onClick={reverse}
              >
                Reverse
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
