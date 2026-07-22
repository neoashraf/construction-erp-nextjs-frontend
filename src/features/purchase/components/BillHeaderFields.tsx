"use client";

import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { PoPicker } from "./PoPicker";
import { cn } from "@/lib/utils";
import { type BillFormValues } from "../schemas/bill.schema";
import { type ProjectOption, type SupplierOption } from "../types";

type Errors = Partial<Record<keyof BillFormValues, string>>;

/**
 * Bill header fields (brief §Scope 4; spec §7; Purchase Bill.dc.html header card). A single
 * horizontal flex-wrap row: Supplier · Project · From PO · Supplier inv. ref · Bill date · Due
 * date · Narration, each a fixed-width field with an UPPERCASE label + red `*` / "— optional".
 * Supplier + project drive the "from PO" picker (an optional APPROVED/PARTIALLY_* PO of the
 * same supplier + project defaults lines from its open lines — FR-PUR-003; absent = direct
 * purchase). Deactivated suppliers are excluded from a new pick but preserved on an existing
 * bill (FR edge 14). All controls share the design-system focus/error states.
 */
export function BillHeaderFields({
  values,
  errors,
  disabled,
  projects,
  suppliers,
  onChange,
}: {
  values: BillFormValues;
  errors: Errors;
  disabled?: boolean;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  onChange: (patch: Partial<BillFormValues>) => void;
}) {
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const supplierChoices = suppliers.filter((s) => s.isActive || s.id === values.supplierId);

  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <FormField className="w-full sm:w-[232px]" label="Supplier" htmlFor="bill-supplier" required error={errors.supplierId}>
        <Select
          id="bill-supplier"
          value={values.supplierId}
          disabled={disabled}
          invalid={!!errors.supplierId}
          data-testid="bill-supplier"
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

      <FormField className="w-full sm:w-[232px]" label="Project" htmlFor="bill-project" required error={errors.projectId}>
        <Select
          id="bill-project"
          value={values.projectId}
          disabled={disabled}
          invalid={!!errors.projectId}
          data-testid="bill-project"
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

      <FormField className="w-full sm:w-[210px]" label="From PO" htmlFor="bill-po" error={errors.purchaseOrderId} optional>
        <PoPicker
          id="bill-po"
          value={values.purchaseOrderId}
          onChange={(id) => onChange({ purchaseOrderId: id })}
          projectId={values.projectId || undefined}
          supplierId={values.supplierId || undefined}
          disabled={disabled || !values.supplierId || !values.projectId}
          invalid={!!errors.purchaseOrderId}
          ariaLabel="From purchase order"
          placeholder="Direct purchase (no PO)"
        />
      </FormField>

      <FormField className="w-full sm:w-[170px]" label="Supplier inv. ref" htmlFor="bill-supplier-invoice" error={errors.supplierInvoiceRef} optional>
        <Input
          id="bill-supplier-invoice"
          value={values.supplierInvoiceRef}
          disabled={disabled}
          className="font-mono"
          data-testid="bill-supplier-invoice"
          onChange={(e) => onChange({ supplierInvoiceRef: e.target.value })}
        />
      </FormField>

      <FormField className="w-full sm:w-[150px]" label="Bill date" htmlFor="bill-date" required error={errors.billDate}>
        <DatePickerInput
          id="bill-date"
          value={values.billDate}
          disabled={disabled}
          invalid={!!errors.billDate}
          onChange={(v) => onChange({ billDate: v })}
        />
      </FormField>

      <FormField className="w-full sm:w-[150px]" label="Due date" htmlFor="bill-due-date" required error={errors.dueDate}>
        <DatePickerInput
          id="bill-due-date"
          value={values.dueDate}
          disabled={disabled}
          invalid={!!errors.dueDate}
          onChange={(v) => onChange({ dueDate: v })}
        />
      </FormField>

      <FormField className="w-full flex-1 sm:min-w-[240px]" label="Narration" htmlFor="bill-narration" optional>
        <Textarea
          id="bill-narration"
          value={values.narration}
          disabled={disabled}
          rows={2}
          data-testid="bill-narration"
          onChange={(e) => onChange({ narration: e.target.value })}
        />
      </FormField>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  optional,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const errId = `${htmlFor}-err`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
        {optional && (
          <span className="ml-1 font-medium normal-case tracking-normal text-faint"> — optional</span>
        )}
      </label>
      {children}
      {error && (
        <p id={errId} className="text-[12px] text-destructive-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
