"use client";

import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { type PoFormValues } from "../schemas/order.schema";
import { type ProjectOption, type SupplierOption, type PurchaseOrderStatus } from "../types";

type Errors = Partial<Record<keyof PoFormValues, string>>;

/**
 * PO header card (brief §Scope 4; spec §7; Purchase Orders.dc.html editor "HEADER CARD").
 * Top row = `PO REF NO` + mono ref + status pill, divided from a single horizontal field
 * row: Project · Supplier · PO date · Expected delivery, then a full-width Narration. Labels
 * are uppercase with a red `*` on required and an inline "— optional" note. PM-scoped projects
 * come pre-filtered from the parent; a previously selected deactivated supplier is preserved
 * for read-only display (FR edge 14). All controls share the design-system focus/error states.
 */
export function PoHeaderFields({
  values,
  errors,
  disabled,
  poRefNo,
  status,
  projects,
  suppliers,
  onChange,
}: {
  values: PoFormValues;
  errors: Errors;
  disabled?: boolean;
  poRefNo: string;
  status: PurchaseOrderStatus;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  onChange: (patch: Partial<PoFormValues>) => void;
}) {
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const supplierChoices = suppliers.filter((s) => s.isActive || s.id === values.supplierId);

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      {/* PO ref no · status — divided from the fields below */}
      <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
            PO ref no
          </span>
          <span className="font-mono text-[14px] font-semibold text-foreground" data-testid="po-ref-no">
            {poRefNo}
          </span>
          <PurchaseStatusBadge status={status} />
        </div>
      </div>

      {/* Single horizontal field row: Project · Supplier · PO date · Expected delivery, Narration full-width */}
      <div className="flex flex-wrap items-start gap-3.5">
        <FormField className="w-full sm:w-[236px]" label="Project" htmlFor="po-project" required error={errors.projectId}>
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

        <FormField className="w-full sm:w-[236px]" label="Supplier" htmlFor="po-supplier" required error={errors.supplierId}>
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

        <FormField className="w-full sm:w-[150px]" label="PO date" htmlFor="po-date" required error={errors.poDate}>
          <DatePickerInput
            id="po-date"
            value={values.poDate}
            disabled={disabled}
            invalid={!!errors.poDate}
            onChange={(v) => onChange({ poDate: v })}
          />
        </FormField>

        <FormField
          className="w-full sm:w-[170px]"
          label="Expected delivery"
          htmlFor="po-expected"
          error={errors.expectedDeliveryDate}
          optional
        >
          <DatePickerInput
            id="po-expected"
            value={values.expectedDeliveryDate}
            disabled={disabled}
            invalid={!!errors.expectedDeliveryDate}
            onChange={(v) => onChange({ expectedDeliveryDate: v })}
          />
        </FormField>

        <FormField className="w-full flex-1 sm:min-w-[240px]" label="Narration" htmlFor="po-narration" optional>
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
