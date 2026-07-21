"use client";

import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { PoPicker } from "./PoPicker";
import { type GrnFormValues } from "../schemas/grn.schema";
import { type ProjectOption, type PurchaseBillSummary, type SupplierOption } from "../types";

export interface GrnHeaderErrors {
  projectId?: string;
  supplierId?: string;
  purchaseOrderId?: string;
  purchaseBillId?: string;
  receiptDate?: string;
  narration?: string;
}

/**
 * GRN entry header (brief §Scope 3; spec §5). The Store Keeper picks a reference —
 * PO and/or Bill (one required) — from which lines pre-fill; project + supplier
 * inherit from the picked reference and render read-only. Receipt date defaults
 * today; narration is an optional Bangla-safe discrepancy note. Every input uses
 * the shared design-system field states (focus + error) via `components/ui/*`.
 */
export function GrnHeaderFields({
  values,
  errors,
  disabled,
  projects,
  suppliers,
  bills,
  onChange,
}: {
  values: GrnFormValues;
  errors: GrnHeaderErrors;
  disabled: boolean;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  bills: PurchaseBillSummary[];
  onChange: (patch: Partial<GrnFormValues>) => void;
}) {
  const project = projects.find((p) => p.id === values.projectId);
  const projectLabel = project
    ? project.projectCode
      ? `${project.projectCode} — ${project.name}`
      : project.name
    : "";
  const supplier = suppliers.find((s) => s.id === values.supplierId);
  const supplierLabel = supplier?.name ?? "";

  const eligibleBills = bills.filter(
    (b) =>
      b.status === "POSTED" &&
      (!values.projectId || b.projectId === values.projectId) &&
      (!values.supplierId || b.supplierId === values.supplierId),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Top row — PO ref / Bill ref / Project / Receipt date (design 4-col grid;
          collapses to 2-col then 1-col below lg/sm). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="PO reference" htmlFor="grn-po" required hint="Approved · partially received" error={errors.purchaseOrderId} errorTestid="grn-po-error">
          <PoPicker
            id="grn-po"
            value={values.purchaseOrderId}
            onChange={(id) => onChange({ purchaseOrderId: id, purchaseBillId: "" })}
            projectId={values.projectId || undefined}
            supplierId={values.supplierId || undefined}
            disabled={disabled}
            invalid={!!errors.purchaseOrderId}
            placeholder="Select a purchase order…"
          />
        </Field>

        <Field label="Bill reference" htmlFor="grn-bill" hint="One of PO / Bill is required" error={errors.purchaseBillId} errorTestid="grn-bill-error">
          <Select
            id="grn-bill"
            value={values.purchaseBillId}
            disabled={disabled}
            invalid={!!errors.purchaseBillId}
            onChange={(e) => onChange({ purchaseBillId: e.target.value, purchaseOrderId: "" })}
            data-testid="grn-bill"
          >
            <option value="">Optional — none linked</option>
            {eligibleBills.map((b) => (
              <option key={b.id} value={b.id}>
                {b.entryNo ?? "Draft"} · {b.billDate}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Project" hint="Inherited from PO · locked">
          <div
            className="flex h-9 items-center rounded-token border border-dashed border-border-strong bg-surface-2 px-3 text-sm text-foreground"
            data-testid="grn-project"
          >
            {projectLabel || <span className="text-faint">Inherits from PO/Bill</span>}
          </div>
        </Field>

        <Field label="Receipt date" htmlFor="grn-date" required hint="Defaults to today" error={errors.receiptDate} errorTestid="grn-date-error">
          <DatePickerInput
            id="grn-date"
            value={values.receiptDate}
            onChange={(v) => onChange({ receiptDate: v })}
            disabled={disabled}
            invalid={!!errors.receiptDate}
          />
        </Field>
      </div>

      {/* Divider + Supplier (narrow) / Narration (wide) — design second row. */}
      <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-[1.1fr_2.3fr]">
        <Field label="Supplier" hint="Inherited from PO · locked">
          <div
            className="flex h-9 items-center rounded-token border border-dashed border-border-strong bg-surface-2 px-3 text-sm text-foreground"
            data-testid="grn-supplier"
          >
            {supplierLabel || <span className="text-faint">Inherits from PO/Bill</span>}
          </div>
        </Field>

        <Field label="Narration · discrepancy note" htmlFor="grn-narration" optional>
          <Textarea
            id="grn-narration"
            value={values.narration}
            disabled={disabled}
            onChange={(e) => onChange({ narration: e.target.value })}
            placeholder="e.g. 10 bags short — supplier will re-deliver"
            rows={2}
            data-testid="grn-narration"
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * Header field wrapper (mirrors the Bill/PO header FormField): micro-label with an
 * optional `*` / "— optional" marker, the control, then either an inline error
 * (destructive) or a muted hint line.
 */
function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  errorTestid,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  errorTestid?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="ml-1 font-normal normal-case text-faint">— optional</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-[12px] text-destructive-ink" data-testid={errorTestid} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
