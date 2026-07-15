"use client";

import { Info } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney } from "@/lib/money";
import { derivedCashReceived, type FieldErrors, type ReceiptFormValues } from "../schemas/receipt.schema";

/**
 * Right-column money block (spec §5 "money block"; design "Amount"). Amount settled +
 * (§A only) tax deducted at source + derived read-only cash-received (`aria-live="polite"`).
 * Zero-cash fully-withheld is valid — shows an informational note, never a blocker
 * (FR-REC-019/020, edge case 6).
 */
export function ReceiptMoneyBlock({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: ReceiptFormValues;
  errors: FieldErrors;
  disabled: boolean;
  onChange: (patch: Partial<ReceiptFormValues>) => void;
}) {
  const isIpc = values.receiptType === "IPC_LINKED";
  const cashReceived = derivedCashReceived(values);
  const zeroCash =
    isIpc &&
    values.amountSettled.trim() !== "" &&
    values.taxDeductedAtSource.trim() !== "" &&
    !errors.amountSettled &&
    !errors.taxDeductedAtSource &&
    Number(cashReceived) === 0 &&
    Number(values.amountSettled) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="receipt-amount-settled"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
        >
          Amount settled <span className="text-destructive">*</span>
        </label>
        <MoneyInput
          id="receipt-amount-settled"
          value={values.amountSettled}
          onChange={(e) => onChange({ amountSettled: e.target.value })}
          invalid={!!errors.amountSettled}
          disabled={disabled}
          className="h-11 text-[16px] font-bold"
          data-testid="receipt-amount-settled"
        />
        {errors.amountSettled && (
          <p
            role="alert"
            className="mt-1.5 text-[12px] font-medium text-destructive"
            data-testid="receipt-amount-settled-err"
          >
            {errors.amountSettled}
          </p>
        )}
      </div>

      {isIpc && (
        <div>
          <label
            htmlFor="receipt-tds"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          >
            Tax deducted at source{" "}
            <span className="font-normal normal-case tracking-normal text-faint">· withheld by customer</span>
          </label>
          <MoneyInput
            id="receipt-tds"
            value={values.taxDeductedAtSource}
            onChange={(e) => onChange({ taxDeductedAtSource: e.target.value })}
            invalid={!!errors.taxDeductedAtSource}
            disabled={disabled}
            data-testid="receipt-tds"
          />
          {errors.taxDeductedAtSource && (
            <p className="mt-1.5 text-[12px] font-medium text-destructive" data-testid="receipt-tds-err">
              {errors.taxDeductedAtSource}
            </p>
          )}
        </div>
      )}

      <div
        aria-live="polite"
        className="rounded-card bg-primary px-4 py-3"
        data-testid="receipt-cash-received"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-primary-foreground/70">
            {isIpc ? "Cash received (after tax deducted)" : "Cash received"}
          </span>
          {isIpc && (
            <span className="ml-auto text-[10px] text-primary-foreground/60">what actually reaches the bank/cash</span>
          )}
        </div>
        <div className="mt-1 font-mono text-[22px] font-bold tabular-nums tracking-tight text-primary-foreground">
          {formatMoney(cashReceived)}
        </div>
      </div>

      {zeroCash && (
        <p
          className="inline-flex items-start gap-1.5 text-[12px] text-muted-foreground"
          data-testid="receipt-zero-cash-note"
        >
          <Info className="mt-[1px] h-3.5 w-3.5 flex-none" aria-hidden />
          The full settled amount was withheld by the customer.
        </p>
      )}
    </div>
  );
}
