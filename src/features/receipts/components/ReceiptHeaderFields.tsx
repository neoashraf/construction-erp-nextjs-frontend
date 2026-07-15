"use client";

import { Banknote, CreditCard, Landmark, Smartphone, type LucideIcon } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { type AccountOption, type PaymentMode } from "../types";
import { requiresChequeRef, type FieldErrors, type ReceiptFormValues } from "../schemas/receipt.schema";

const MODES: { code: PaymentMode; label: string; icon: LucideIcon }[] = [
  { code: "CASH", label: "Cash", icon: Banknote },
  { code: "MFS", label: "MFS", icon: Smartphone },
  { code: "BANK_TRANSFER", label: "Bank", icon: Landmark },
  { code: "CHEQUE", label: "Cheque", icon: CreditCard },
];

const REF_LABEL: Record<PaymentMode, string> = {
  CASH: "",
  MFS: "MFS transaction ID",
  BANK_TRANSFER: "Bank transaction reference",
  CHEQUE: "Cheque number",
};

/**
 * Shared header for both modes (spec §5 "Shared header"; design §"Payment"). Receipt date +
 * payment-mode segmented control (all four first-class per overview §9) + deposit-account
 * picker + conditional reference field + narration. Every input carries the design-system
 * focus + error states via the shared primitives (spec §"Design fidelity" — never a bespoke
 * per-screen focus/validation style).
 */
export function ReceiptHeaderFields({
  values,
  errors,
  accounts,
  disabled,
  onChange,
}: {
  values: ReceiptFormValues;
  errors: FieldErrors;
  accounts: AccountOption[];
  disabled: boolean;
  onChange: (patch: Partial<ReceiptFormValues>) => void;
}) {
  const refShown = requiresChequeRef(values.paymentMode);
  const refLabel = values.paymentMode ? REF_LABEL[values.paymentMode] : "";

  // Deposit accounts: ASSET-typed active accounts (bank/cash/MFS). Server backstops the
  // full whitelist; the client just narrows to a sensible subset.
  const depositOpts = accounts.filter((a) => a.isActive && a.type === "ASSET");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <Field label="Receipt date" required error={errors.receiptDate} htmlFor="receipt-date">
          <DatePickerInput
            id="receipt-date"
            value={values.receiptDate}
            onChange={(v) => onChange({ receiptDate: v })}
            invalid={!!errors.receiptDate}
            disabled={disabled}
          />
        </Field>

        <Field label="Payment mode" required error={errors.paymentMode}>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Payment mode">
            {MODES.map(({ code, label, icon: Icon }) => {
              const active = values.paymentMode === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => onChange({ paymentMode: code })}
                  data-testid={`receipt-mode-${code}`}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-token border text-[12.5px] font-semibold transition",
                    active
                      ? "border-accent bg-accent-soft text-accent-ink shadow-focus"
                      : "border-border-strong bg-surface text-foreground hover:border-accent hover:bg-accent-soft/50",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className={cn("grid gap-4", refShown ? "sm:grid-cols-[1fr_1fr]" : "sm:grid-cols-1")}>
        <Field
          label="Deposit account"
          required
          hint="the account debited"
          error={errors.depositAccountId}
          htmlFor="receipt-deposit-account"
        >
          <Select
            id="receipt-deposit-account"
            value={values.depositAccountId}
            onChange={(e) => onChange({ depositAccountId: e.target.value })}
            invalid={!!errors.depositAccountId}
            disabled={disabled}
          >
            <option value="">Choose an account…</option>
            {depositOpts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </Select>
        </Field>

        {refShown && (
          <Field
            label={refLabel}
            required
            error={errors.chequeTxnRef}
            htmlFor="receipt-cheque-ref"
          >
            <Input
              id="receipt-cheque-ref"
              value={values.chequeTxnRef}
              onChange={(e) => onChange({ chequeTxnRef: e.target.value })}
              invalid={!!errors.chequeTxnRef}
              disabled={disabled}
              placeholder={values.paymentMode === "CHEQUE" ? "Cheque no." : "Reference"}
              data-testid="receipt-cheque-ref"
            />
          </Field>
        )}
      </div>

      <Field label="Narration" hint="optional" htmlFor="receipt-narration">
        <Textarea
          id="receipt-narration"
          value={values.narration}
          onChange={(e) => onChange({ narration: e.target.value })}
          disabled={disabled}
          rows={3}
          className="min-h-[64px] resize-none"
          data-testid="receipt-narration"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 font-normal normal-case tracking-normal text-faint">· {hint}</span>}
      </label>
      {children}
      {error && (
        <p className="text-[12px] font-medium text-destructive" data-testid={htmlFor ? `${htmlFor}-err` : undefined}>
          {error}
        </p>
      )}
    </div>
  );
}
