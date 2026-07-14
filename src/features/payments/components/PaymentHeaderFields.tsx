"use client";

import { Banknote, CreditCard, Landmark, Smartphone, Zap, type LucideIcon } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { requiresChequeRef, type FieldErrors, type PaymentFormValues } from "../schemas/payment.schema";
import { type AccountOption, type PartyOption, type PaymentMode } from "../types";

const MODES: { code: PaymentMode; label: string; icon: LucideIcon }[] = [
  { code: "CASH", label: "Cash", icon: Banknote },
  { code: "MFS", label: "MFS", icon: Smartphone },
  { code: "BANK_TRANSFER", label: "Bank", icon: Landmark },
  { code: "CHEQUE", label: "Cheque", icon: CreditCard },
  { code: "RTGS", label: "RTGS", icon: Zap },
];

const REF_LABEL: Record<PaymentMode, string> = {
  CASH: "",
  MFS: "MFS transaction ID",
  BANK_TRANSFER: "Bank transaction reference",
  CHEQUE: "Cheque number",
  RTGS: "RTGS reference",
};

/**
 * Shared header for the payment editor (spec §5 Header). Payee party + date + mode
 * segmented control (all five first-class per overview §9) + paying account + conditional
 * cheque/txn ref + payment amount + narration. Every input carries the design-system
 * focus + error states via the shared primitives.
 */
export function PaymentHeaderFields({
  values,
  errors,
  parties,
  accounts,
  disabled,
  onPayeeChangeAttempt,
  onChange,
}: {
  values: PaymentFormValues;
  errors: FieldErrors;
  parties: PartyOption[];
  accounts: AccountOption[];
  disabled: boolean;
  onPayeeChangeAttempt: (nextPartyId: string) => void;
  onChange: (patch: Partial<PaymentFormValues>) => void;
}) {
  const refShown = requiresChequeRef(values.paymentMode);
  const refLabel = values.paymentMode ? REF_LABEL[values.paymentMode] : "";
  const bankAccounts = accounts.filter((a) => a.isActive && a.type === "ASSET");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label="Payee (party)" required hint="the receiving supplier / staff aggregate" error={errors.partyId} htmlFor="pay-party">
          <Select
            id="pay-party"
            value={values.partyId}
            onChange={(e) => onPayeeChangeAttempt(e.target.value)}
            invalid={!!errors.partyId}
            disabled={disabled}
            data-testid="payment-editor-party"
          >
            <option value="">Choose a payee…</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Payment date" required error={errors.paymentDate} htmlFor="pay-date">
          <DatePickerInput
            id="pay-date"
            value={values.paymentDate}
            onChange={(v) => onChange({ paymentDate: v })}
            invalid={!!errors.paymentDate}
            disabled={disabled}
          />
        </Field>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Payment mode <span className="text-destructive">*</span>
        </label>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5" role="group" aria-label="Payment mode">
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
                data-testid={`payment-editor-mode-${code}`}
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
        {errors.paymentMode && (
          <p className="mt-1 text-[12px] font-medium text-destructive">{errors.paymentMode}</p>
        )}
      </div>

      <div className={cn("grid gap-4", refShown ? "sm:grid-cols-2" : "")}>
        <Field label="Paying account" required hint="bank/cash/MFS" error={errors.paymentAccountId} htmlFor="pay-account">
          <Select
            id="pay-account"
            value={values.paymentAccountId}
            onChange={(e) => onChange({ paymentAccountId: e.target.value })}
            invalid={!!errors.paymentAccountId}
            disabled={disabled}
            data-testid="payment-editor-account"
          >
            <option value="">Choose an account…</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </Select>
        </Field>
        {refShown && (
          <Field label={refLabel} required error={errors.chequeTxnRef} htmlFor="pay-cheque-ref">
            <Input
              id="pay-cheque-ref"
              value={values.chequeTxnRef}
              onChange={(e) => onChange({ chequeTxnRef: e.target.value })}
              invalid={!!errors.chequeTxnRef}
              disabled={disabled}
              placeholder={values.paymentMode === "CHEQUE" ? "Cheque no." : "Reference"}
              data-testid="payment-editor-cheque-ref"
            />
          </Field>
        )}
      </div>

      <div>
        <label htmlFor="pay-amount" className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Payment amount <span className="text-destructive">*</span>
        </label>
        <MoneyInput
          id="pay-amount"
          value={values.paymentAmount}
          onChange={(e) => onChange({ paymentAmount: e.target.value })}
          invalid={!!errors.paymentAmount}
          disabled={disabled}
          className="h-11 text-[16px] font-bold"
          data-testid="payment-editor-amount"
        />
        {errors.paymentAmount && (
          <p className="mt-1 text-[12px] font-medium text-destructive" data-testid="payment-editor-amount-err">
            {errors.paymentAmount}
          </p>
        )}
      </div>

      <Field label="Narration" hint="optional" htmlFor="pay-narration">
        <Textarea
          id="pay-narration"
          value={values.narration}
          onChange={(e) => onChange({ narration: e.target.value })}
          disabled={disabled}
          rows={3}
          className="min-h-[64px] resize-none"
          data-testid="payment-editor-narration"
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
