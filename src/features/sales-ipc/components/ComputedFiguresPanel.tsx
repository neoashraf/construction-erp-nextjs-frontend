"use client";

import { Clock } from "lucide-react";
import Decimal from "decimal.js";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { IPC_DEFAULT_RATES, type FieldErrors, type IpcFormValues } from "../schemas/ipc.schema";

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

/** Effective retention rate for the label (retention ÷ certified × 100), or the config default. */
function effectiveRetentionPct(values: IpcFormValues): string {
  const c = dec(values.certifiedAmount);
  if (c.isZero()) return IPC_DEFAULT_RATES.retentionRatePct;
  return dec(values.retentionAmount).dividedBy(c).times(100).toFixed(2);
}

/** One figure row — label + hint on the left, an editable/deduction money field on the right. */
function FigureRow({
  label,
  hint,
  field,
  value,
  error,
  deduction,
  readOnly,
  onChange,
  testId,
}: {
  label: string;
  hint: string;
  field: keyof IpcFormValues;
  value: string;
  error?: string;
  deduction?: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<IpcFormValues>) => void;
  testId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 pt-1.5">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        <div className="text-[11.5px] text-muted-foreground">{hint}</div>
      </div>
      <div className="w-[180px] flex-none">
        <div className="flex items-center gap-1">
          {deduction && <span className="text-[13px] font-semibold text-destructive-ink" aria-hidden>−</span>}
          <MoneyInput
            aria-label={label}
            className={cn("h-9", deduction && "text-destructive-ink")}
            value={value}
            invalid={!!error}
            disabled={readOnly}
            data-testid={testId}
            onChange={(e) => onChange({ [field]: e.target.value } as Partial<IpcFormValues>)}
          />
        </div>
        {error && <p className="mt-1 text-right text-[11.5px] font-medium text-destructive">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Live computed-figures panel (spec §4/§7; design "Figures"). Output VAT (default 7.5 % ×
 * certified) · AIT/TDS · Retention (default 10 %, overridable — FR-SAL-006) · Advance recovered
 * (default 15 %, capped at the remaining project advance — FR-SAL-008), then the prominent
 * read-only **currently due** = `certified + VAT − retention − advance − AIT` (FR-SAL-004),
 * announced via `aria-live` on every recompute (a11y §10). All figures are `Decimal(18,4)`.
 */
export function ComputedFiguresPanel({
  values,
  errors,
  currentlyDue,
  negative,
  remainingAdvance,
  hasMobilizationAdvance,
  readOnly,
  onChange,
}: {
  values: IpcFormValues;
  errors: FieldErrors;
  currentlyDue: string;
  negative: boolean;
  remainingAdvance: string;
  hasMobilizationAdvance: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<IpcFormValues>) => void;
}) {
  const remaining = dec(remainingAdvance);
  const advanceHelper = !hasMobilizationAdvance
    ? "No mobilization advance on this project."
    : remaining.isZero()
      ? "Advance fully recovered."
      : `Remaining project advance ৳ ${formatMoney(remainingAdvance, { withSymbol: false, fractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-foreground">Figures</h2>
        <span className="text-[11px] text-faint">live · Decimal(18,4)</span>
      </div>

      <div className="divide-y divide-border">
        <FigureRow
          label="Output VAT" hint="7.5% × certified · editable" field="outputVatAmount"
          value={values.outputVatAmount} error={errors.outputVatAmount} readOnly={readOnly} onChange={onChange} testId="ipc-vat"
        />
        <FigureRow
          label="AIT / TDS" hint="source tax withheld · editable" field="aitTdsAmount" deduction
          value={values.aitTdsAmount} error={errors.aitTdsAmount} readOnly={readOnly} onChange={onChange} testId="ipc-ait"
        />
        <FigureRow
          label="Retention" hint={`effective ${effectiveRetentionPct(values)}% · overridable`} field="retentionAmount" deduction
          value={values.retentionAmount} error={errors.retentionAmount} readOnly={readOnly} onChange={onChange} testId="ipc-retention"
        />
        <FigureRow
          label="Advance recovered" hint="15% × certified · capped" field="advanceRecoveredAmount" deduction
          value={values.advanceRecoveredAmount} error={errors.advanceRecoveredAmount} readOnly={readOnly} onChange={onChange} testId="ipc-advance"
        />
      </div>

      <div
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-medium",
          hasMobilizationAdvance && !remaining.isZero() ? "bg-accent-soft text-accent-ink" : "bg-muted text-muted-foreground",
        )}
        data-testid="ipc-advance-helper"
      >
        <Clock className="h-3 w-3" aria-hidden />
        {advanceHelper}
      </div>

      {/* Currently due — the prominent read-only residual (aria-live). */}
      <div className="rounded-card bg-primary px-4 py-3.5 text-primary-foreground" data-testid="ipc-currently-due-panel">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-primary-foreground/70">Currently due</span>
          <span className="text-[11px] text-primary-foreground/60">AR debit at post</span>
        </div>
        <div
          className="mt-1 font-mono text-[26px] font-bold tabular-nums"
          role="status"
          aria-live="polite"
          aria-label={`Currently due ৳ ${formatMoney(currentlyDue, { withSymbol: false })}`}
          data-testid="ipc-currently-due"
        >
          {formatMoney(currentlyDue)}
        </div>
        <div className="mt-1 text-[11px] text-primary-foreground/60">
          certified + VAT − retention − advance − AIT · always the residual
        </div>
      </div>

      {negative && (
        <div className="rounded-card border border-destructive bg-destructive-soft px-3 py-2 text-[12.5px] font-medium text-destructive-ink" role="alert" data-testid="ipc-currently-due-negative">
          These figures make the currently-due amount negative. Adjust the retention, advance or taxes.
        </div>
      )}
    </div>
  );
}
