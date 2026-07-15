"use client";

import { Tag } from "lucide-react";
import { Select } from "@/components/ui/select";
import { type AccountOption, type CostCentreOption, type ProjectOption, type PurposeOption } from "../types";
import { type FieldErrors, type ReceiptFormValues } from "../schemas/receipt.schema";

/**
 * §B General-receipt block (spec §5/§7; design "Allocation"). Party + general target
 * (INCOME or advance-from-customer LIABILITY only, `INVALID_GENERAL_TARGET` server
 * backstop), optional project, required cost centre, project-scoped purpose. A blank
 * project shows the "Tagged: General (no project)" note (FR-REC-003, FR-REC-007).
 */
export function GeneralReceiptBlock({
  values,
  errors,
  parties,
  accounts,
  projects,
  costCentres,
  purposes,
  purposesLoading,
  disabled,
  onChange,
}: {
  values: ReceiptFormValues;
  errors: FieldErrors;
  parties: { id: string; name: string; isActive: boolean }[];
  accounts: AccountOption[];
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  purposesLoading: boolean;
  disabled: boolean;
  onChange: (patch: Partial<ReceiptFormValues>) => void;
}) {
  // General target = INCOME + LIABILITY (broad — server enforces the exact whitelist).
  const targetOpts = accounts.filter((a) => a.isActive && (a.type === "INCOME" || a.type === "LIABILITY"));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Party" required hint="the payer" error={errors.partyId} htmlFor="receipt-party">
          <Select
            id="receipt-party"
            value={values.partyId}
            onChange={(e) => onChange({ partyId: e.target.value })}
            invalid={!!errors.partyId}
            disabled={disabled}
            data-testid="receipt-party"
          >
            <option value="">Choose a party…</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Credit to" required hint="income or advance liability" error={errors.generalTargetAccountId} htmlFor="receipt-target">
          <Select
            id="receipt-target"
            value={values.generalTargetAccountId}
            onChange={(e) => onChange({ generalTargetAccountId: e.target.value })}
            invalid={!!errors.generalTargetAccountId}
            disabled={disabled}
            data-testid="receipt-target"
          >
            <option value="">Choose an income or advance account…</option>
            {targetOpts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Project" hint="optional" htmlFor="receipt-project">
          <Select
            id="receipt-project"
            value={values.projectId}
            onChange={(e) => onChange({ projectId: e.target.value, purposeId: "" })}
            disabled={disabled}
            data-testid="receipt-project"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode ? `${p.projectCode} · ${p.name}` : p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cost centre" required error={errors.costCentreId} htmlFor="receipt-cost-centre">
          <Select
            id="receipt-cost-centre"
            value={values.costCentreId}
            onChange={(e) => onChange({ costCentreId: e.target.value })}
            invalid={!!errors.costCentreId}
            disabled={disabled}
            data-testid="receipt-cost-centre"
          >
            <option value="">Choose a cost centre…</option>
            {costCentres.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Purpose"
          required={!!values.projectId}
          hint={values.projectId ? undefined : "with a project"}
          error={errors.purposeId}
          htmlFor="receipt-purpose"
        >
          <Select
            id="receipt-purpose"
            value={values.purposeId}
            onChange={(e) => onChange({ purposeId: e.target.value })}
            invalid={!!errors.purposeId}
            disabled={disabled || !values.projectId || purposesLoading}
            data-testid="receipt-purpose"
          >
            <option value="">{values.projectId ? (purposesLoading ? "Loading…" : "Choose a purpose…") : "—"}</option>
            {purposes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      {!values.projectId && (
        <div
          className="inline-flex w-fit items-center gap-2 rounded-token bg-muted px-3 py-1.5 text-[12px] font-semibold text-muted-foreground"
          data-testid="receipt-general-note"
        >
          <Tag className="h-3.5 w-3.5" aria-hidden />
          Tagged: General (no project)
        </div>
      )}
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
