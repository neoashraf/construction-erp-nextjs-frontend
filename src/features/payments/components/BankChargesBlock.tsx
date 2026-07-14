"use client";

import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { type CostCentreOption, type PurposeOption } from "../api/masters";
import { type ProjectOption } from "../types";
import { type FieldErrors, type PaymentFormValues } from "../schemas/payment.schema";

/**
 * Bank-charges block (spec §5; FR-PAY-003/-004). `bankChargesAmount` defaults to 0;
 * when > 0 the project + cost_centre + purpose become required and the purpose must
 * belong to the project (`CROSS_PROJECT_DIMENSION` — server backstop). Over-budget is
 * advisory (surfaced from `meta.budgetWarnings` at Post, never blocks).
 */
export function BankChargesBlock({
  values,
  errors,
  projects,
  costCentres,
  purposes,
  disabled,
  onChange,
}: {
  values: PaymentFormValues;
  errors: FieldErrors;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  disabled: boolean;
  onChange: (patch: Partial<PaymentFormValues>) => void;
}) {
  const hasCharges = Number(values.bankChargesAmount || "0") > 0;
  return (
    <Card className="p-5" data-testid="payment-bank-charges">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">3</span>
        <h2 className="text-[14px] font-bold text-foreground">Bank charges</h2>
        <span className="text-[11.5px] text-muted-foreground">optional · expensed if &gt; 0</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="pay-bc-amount" className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Amount
          </label>
          <MoneyInput
            id="pay-bc-amount"
            value={values.bankChargesAmount}
            onChange={(e) => onChange({ bankChargesAmount: e.target.value })}
            invalid={!!errors.bankChargesAmount}
            disabled={disabled}
            data-testid="payment-bank-charges-amount"
          />
          {errors.bankChargesAmount && (
            <p className="mt-1 text-[12px] font-medium text-destructive">{errors.bankChargesAmount}</p>
          )}
        </div>
        <SmallSelect
          label="Project"
          required={hasCharges}
          value={values.bankChargesProjectId}
          onChange={(v) => onChange({ bankChargesProjectId: v, bankChargesPurposeId: "" })}
          disabled={disabled || !hasCharges}
          invalid={!!errors.bankChargesProjectId}
          error={errors.bankChargesProjectId}
          testId="payment-bank-charges-project"
        >
          <option value="">Choose…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.projectCode ? `${p.projectCode} · ${p.name}` : p.name}</option>
          ))}
        </SmallSelect>
        <SmallSelect
          label="Cost centre"
          required={hasCharges}
          value={values.bankChargesCostCentreId}
          onChange={(v) => onChange({ bankChargesCostCentreId: v })}
          disabled={disabled || !hasCharges}
          invalid={!!errors.bankChargesCostCentreId}
          error={errors.bankChargesCostCentreId}
          testId="payment-bank-charges-cost-centre"
        >
          <option value="">Choose…</option>
          {costCentres.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </SmallSelect>
        <SmallSelect
          label="Purpose"
          required={hasCharges}
          value={values.bankChargesPurposeId}
          onChange={(v) => onChange({ bankChargesPurposeId: v })}
          disabled={disabled || !hasCharges || !values.bankChargesProjectId}
          invalid={!!errors.bankChargesPurposeId}
          error={errors.bankChargesPurposeId}
          testId="payment-bank-charges-purpose"
        >
          <option value="">Choose…</option>
          {purposes.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </SmallSelect>
      </div>
    </Card>
  );
}

function SmallSelect({
  label,
  required,
  value,
  onChange,
  disabled,
  invalid,
  error,
  testId,
  children,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        invalid={invalid}
        data-testid={testId}
      >
        {children}
      </Select>
      {error && <p className="mt-1 text-[12px] font-medium text-destructive">{error}</p>}
    </div>
  );
}
