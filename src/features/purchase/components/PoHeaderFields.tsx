"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { type PoFormValues } from "../schemas/order.schema";
import { type ProjectOption, type SupplierOption } from "../types";

type Errors = Partial<Record<keyof PoFormValues, string>>;

/**
 * PO header fields (brief §Scope 4; spec §7). Project · Supplier · PO date · Expected
 * delivery date · Narration. Two columns at ≥md, one below. PM-scoped projects come
 * pre-filtered from the parent; deactivated suppliers are excluded from a new pick but
 * a previously selected deactivated supplier is preserved for read-only display (FR edge 14).
 * All controls share the design-system focus/error states via `components/ui/*`.
 */
export function PoHeaderFields({
  values,
  errors,
  disabled,
  projects,
  suppliers,
  onChange,
}: {
  values: PoFormValues;
  errors: Errors;
  disabled?: boolean;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  onChange: (patch: Partial<PoFormValues>) => void;
}) {
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const supplierChoices = suppliers.filter((s) => s.isActive || s.id === values.supplierId);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Project" htmlFor="po-project" required error={errors.projectId}>
        <Select
          id="po-project"
          value={values.projectId}
          disabled={disabled}
          invalid={!!errors.projectId}
          data-testid="po-project"
          onChange={(e) => onChange({ projectId: e.target.value })}
        >
          <option value="">Select a project…</option>
          {openProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Supplier" htmlFor="po-supplier" required error={errors.supplierId}>
        <Select
          id="po-supplier"
          value={values.supplierId}
          disabled={disabled}
          invalid={!!errors.supplierId}
          data-testid="po-supplier"
          onChange={(e) => onChange({ supplierId: e.target.value })}
        >
          <option value="">Select a supplier…</option>
          {supplierChoices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="PO date" htmlFor="po-date" required error={errors.poDate}>
        <DatePickerInput
          id="po-date"
          value={values.poDate}
          disabled={disabled}
          invalid={!!errors.poDate}
          onChange={(v) => onChange({ poDate: v })}
        />
      </FormField>

      <FormField
        label="Expected delivery"
        htmlFor="po-expected"
        error={errors.expectedDeliveryDate}
        hint="Optional"
      >
        <DatePickerInput
          id="po-expected"
          value={values.expectedDeliveryDate}
          disabled={disabled}
          invalid={!!errors.expectedDeliveryDate}
          onChange={(v) => onChange({ expectedDeliveryDate: v })}
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Narration" htmlFor="po-narration" hint="Optional">
          <Textarea
            id="po-narration"
            value={values.narration}
            disabled={disabled}
            rows={2}
            data-testid="po-narration"
            onChange={(e) => onChange({ narration: e.target.value })}
          />
        </FormField>
      </div>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const errId = `${htmlFor}-err`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={errId} className="text-[12px] text-destructive-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={cn("text-[11.5px] text-faint")}>{hint}</p>
      ) : null}
    </div>
  );
}
